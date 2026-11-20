import json
import mlflow

import re

from collections import Counter

from typing import TypedDict

from app.services.investigation.deterministic_report import (
    build_deterministic_report,
)


from langgraph.graph import END, START, StateGraph

from sqlalchemy.orm import Session


from app.db.session import engine

from app.models import Investigation, InvestigationSource

from app.services.ai.llm_provider import GroqLLMProvider

from app.services.rag.retrieval_service import retrieve_evidence


from app.services.investigation.graph_context_service import (
    build_graph_context,
)
class InvestigationState(TypedDict, total=False):

    query: str

    limit: int

    document_ids: list[int] | None

    evidence: list[dict]

    report: str

    error: str


# Claims that require particular caution. These are warning heuristics,

# not a substitute for a human analyst reviewing the cited passages.

CAUTION_TERMS = {

    "phishing": (

        "this is phishing",

        "confirmed phishing",

        "phishing activity was observed",

    ),

    "campaign attribution": (

        "belongs to the same campaign",

        "part of the same campaign",

        "same threat campaign",

        "attributed to the same campaign",

    ),

    "common ownership": (

        "same owner",

        "common owner",

        "owned by the same actor",

        "same operator",

    ),

    "command-and-control attribution": (

        "confirmed c2 infrastructure",

        "same command-and-control infrastructure",

        "shared c2 infrastructure",

    ),

    "malware execution": (

        "malware was executed",

        "successfully executed the malware",

        "malware execution was confirmed",

    ),

    "dropper behavior": (

        "confirmed dropper",

        "this url is a dropper",

        "the url delivers a dropper",

    ),

    "confirmed compromise": (

        "host was compromised",

        "system was compromised",

        "confirmed compromise occurred",

        "successful compromise",

    ),


    "unsupported tag interpretation": (

        "macos-specific activity",

        "macos-specific tags",

        "macos-specific payload",

        "linux-based malware",

        "linux malware",

        "consistent with linux-based malware",

        "commonly associated with known botnet families",

        "possible compatibility with arm devices",

        "potential compatibility with arm devices",

        "the host may be a honeypot",

        "host is a honeypot",

        "honeypot activity",

    ),

    "unsupported malware-family attribution": (

        "associated with mirai activity",

        "associated with mozi activity",

        "mirai-type activity",

        "mozi botnet family",

        "mirai botnet family",

    ),


}

@mlflow.trace(name="retrieve_evidence", span_type="RETRIEVER")
def _retrieve_node(state: InvestigationState) -> InvestigationState:

    evidence = retrieve_evidence(

        state["query"],

        limit=state.get("limit", 6),

        document_ids=state.get("document_ids"),

    )

    return {"evidence": evidence}

@mlflow.trace(name="groq_investigation_analysis", span_type="LLM")
def _analyze_node(state: InvestigationState) -> InvestigationState:
    provider = GroqLLMProvider()

    analysis = provider.generate_investigation(
        query=state["query"],
        evidence=state.get("evidence", []),
    )

    return {"report": analysis}


def build_investigation_graph():

    workflow = StateGraph(InvestigationState)

    workflow.add_node("retrieve_evidence", _retrieve_node)

    workflow.add_node("analyze_evidence", _analyze_node)

    workflow.add_edge(START, "retrieve_evidence")

    workflow.add_edge("retrieve_evidence", "analyze_evidence")

    workflow.add_edge("analyze_evidence", END)

    return workflow.compile()


def _parse_source_payload(text: str) -> dict | None:

    """Parse a JSON payload directly or from a JSON object inside a chunk."""

    if not isinstance(text, str) or not text.strip():

        return None


    try:

        payload = json.loads(text)

        if isinstance(payload, dict):

            return payload

    except json.JSONDecodeError:

        pass


    start = text.find("{")

    end = text.rfind("}")

    if start < 0 or end <= start:

        return None


    try:

        payload = json.loads(text[start : end + 1])

        return payload if isinstance(payload, dict) else None

    except json.JSONDecodeError:

        return None


def _source_statistics(evidence: list[dict]) -> list[str]:
    """Calculate auditable statistics from unique, parseable source records."""

    records: dict[str, dict] = {}

    for index, item in enumerate(evidence, start=1):
        payload = _parse_source_payload(item.get("chunk_text", ""))

        if not isinstance(payload, dict):
            continue

        source_id = item.get("source_id") or f"S{index}"
        external_id = payload.get("id")

        record_key = (
            str(external_id)
            if external_id is not None
            else source_id
        )

        records[record_key] = {
            "source_id": source_id,
            "payload": payload,
        }

    if not records:
        return [
            f"- Retrieved evidence passages: {len(evidence)}.",
            "- Unique parseable source records: 0.",
            "- Statistics could not be calculated because no source records were parseable.",
        ]

    parsed = list(records.values())

    lines = [
        f"- Retrieved evidence passages: {len(evidence)}.",
        f"- Unique parseable source records: {len(parsed)}.",
    ]

    threat_types = Counter()
    url_statuses = Counter()
    reporters = Counter()
    tags = Counter()

    for record in parsed:
        payload = record["payload"]

        threat_type = payload.get("threat")
        if threat_type:
            threat_types[str(threat_type)] += 1

        url_status = payload.get("url_status")
        if url_status:
            url_statuses[str(url_status)] += 1

        reporter = payload.get("reporter")
        if reporter:
            reporters[str(reporter)] += 1

        source_tags = payload.get("tags", [])

        if isinstance(source_tags, list):
            for tag in source_tags:
                if isinstance(tag, (str, int, float)) and str(tag).strip():
                    tags[str(tag).strip().casefold()] += 1

    if threat_types:
        lines.append("- Threat classifications:")
        for name, count in threat_types.most_common():
            lines.append(f"  - `{name}`: {count} records.")

    if url_statuses:
        lines.append("- Recorded URL statuses:")
        for name, count in url_statuses.most_common():
            lines.append(f"  - `{name}`: {count} records.")

    if reporters:
        lines.append("- Reporters:")
        for name, count in reporters.most_common():
            lines.append(f"  - `{name}`: {count} records.")

    if tags:
        lines.append("- Source-reported tags:")
        for name, count in tags.most_common():
            lines.append(f"  - `{name}`: {count} records.")

    return lines


def _build_observed_evidence_table(evidence: list[dict]) -> str:
    """Build the observed evidence table directly from retrieved source records."""

    records: dict[str, dict] = {}

    for index, item in enumerate(evidence, start=1):
        payload = _parse_source_payload(item.get("chunk_text", ""))

        if not isinstance(payload, dict):
            continue

        source_id = item.get("source_id") or f"S{index}"
        external_id = payload.get("id")

        # Deduplicate records using their original source ID.
        record_key = str(external_id) if external_id is not None else source_id

        records[record_key] = {
            "source_id": source_id,
            "payload": payload,
        }

    headers = [
        "Record",
        "Host",
        "URL",
        "Status",
        "Blacklists",
        "Reporter",
        "Tags",
        "Threat",
        "Source",
    ]

    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(headers)) + " |",
    ]

    def cell(value) -> str:
        """Make values safe for Markdown table cells."""
        if value is None or value == "":
            return "Not provided"

        return str(value).replace("|", r"\|").replace("\n", " ").strip()

    for record in records.values():
        payload = record["payload"]
        source_id = record["source_id"]

        record_id = payload.get("id", "Not provided")
        host = payload.get("host", "Not provided")
        url = payload.get("url")
        status = payload.get("url_status", "Not provided")
        reporter = payload.get("reporter", "Not provided")
        threat = payload.get("threat", "Not provided")

        # Render the URL as a link when it is available.
        if isinstance(url, str) and url.strip():
            url_cell = f"[Open URL]({url.strip()})"
        else:
            url_cell = "Not provided"

        # Include all blacklist results present in the source record.
        blacklists = payload.get("blacklists", {})

        if isinstance(blacklists, dict) and blacklists:
            blacklist_cell = "; ".join(
                f"{name}={value}"
                for name, value in sorted(blacklists.items())
            )
        else:
            blacklist_cell = "Not provided"

        tags = payload.get("tags", [])

        if isinstance(tags, list) and tags:
            tags_cell = ", ".join(str(tag) for tag in tags)
        else:
            tags_cell = "Not provided"

        row = [
            cell(record_id),
            cell(host),
            url_cell,
            cell(status),
            cell(blacklist_cell),
            cell(reporter),
            cell(tags_cell),
            cell(threat),
            cell(f"[{source_id}]"),
        ]

        lines.append("| " + " | ".join(row) + " |")

    if not records:
        return (
            "No parseable source records were available "
            "to generate the observed evidence table."
        )

    return "\n".join(lines)


def _replace_observed_evidence_section(
    report: str,
    evidence: list[dict],
) -> str:
    """Replace the LLM-generated evidence section with the deterministic table."""

    table = _build_observed_evidence_table(evidence)

    section = "## Observed evidence\n\n" + table

    pattern = re.compile(
        r"(?im)^##\s+Observed evidence\s*$.*?"
        r"(?=^##\s+|\Z)",
        re.DOTALL,
    )

    if pattern.search(report):
        return pattern.sub(lambda _: section + "\n\n", report, count=1)

    # If the LLM omitted the section, insert it after the executive summary.
    executive_pattern = re.compile(
        r"(?im)^##\s+Executive summary\s*$.*?"
        r"(?=^##\s+|\Z)",
        re.DOTALL,
    )

    if executive_pattern.search(report):
        return executive_pattern.sub(
            lambda match: match.group(0).rstrip()
            + "\n\n"
            + section
            + "\n\n",
            report,
            count=1,
        )

    # Fallback if the expected headings are missing.
    return report.rstrip() + "\n\n" + section + "\n"

def _validate_report(

    report: str,

    evidence: list[dict],

) -> tuple[str, list[str]]:

    """

    Run deterministic checks on source references, explicit tag mappings,

    and high-risk claims.


    These checks identify inconsistencies and claims requiring review.

    They do not prove semantic support for every sentence.

    """

    warnings: list[str] = []


    valid_ids = {

        item.get("source_id")

        for item in evidence

        if isinstance(item.get("source_id"), str)

    }


    # 1. Validate citation IDs.

    cited_ids = set(re.findall(r"\[(S\d+)\]", report))

    invalid_ids = sorted(

        cited_ids - valid_ids,

        key=lambda value: int(value[1:]),

    )


    for invalid_id in invalid_ids:

        report = report.replace(

            f"[{invalid_id}]",

            f"[UNVERIFIED SOURCE REFERENCE: {invalid_id}]",

        )

        warnings.append(

            f"Unknown source reference [{invalid_id}]."

        )


    # 2. Build exact source-to-tag mappings from retrieved passages.

    tag_sources: dict[str, set[str]] = {}

    source_tags: dict[str, set[str]] = {}

    source_text: dict[str, str] = {}


    for item in evidence:

        source_id = item.get("source_id")

        if not isinstance(source_id, str):

            continue


        chunk_text = item.get("chunk_text", "")

        source_text[source_id] = (

            chunk_text if isinstance(chunk_text, str) else ""

        )


        payload = _parse_source_payload(source_text[source_id])

        if not isinstance(payload, dict):

            continue


        tags = payload.get("tags", [])

        normalized_tags = {

            str(tag).strip().casefold()

            for tag in tags

            if isinstance(tag, (str, int, float))

            and str(tag).strip()

        } if isinstance(tags, list) else set()


        source_tags[source_id] = normalized_tags


        for tag in normalized_tags:

            tag_sources.setdefault(tag, set()).add(source_id)


    # 3. Validate explicit tag-to-source claims.

    # Example: "mirai appears in [S1], [S2] and [S3]."


    source_pattern = re.compile(
        r"\b([A-Za-z0-9_.-]+)\s+"
        r"(?:appears|occurs|is present)\s+in\s*:?[ \t]*"
        r"((?:\[\s*S\d+\s*\])"
        r"(?:\s*,?\s*(?:and\s*)?\[\s*S\d+\s*\])*)",
        re.IGNORECASE,
    )


    for match in source_pattern.finditer(report):

        tag = match.group(1).casefold()


        claimed_sources = {

            value.upper()

            for value in re.findall(

                r"S\d+",

                match.group(2),

                re.IGNORECASE,

            )

        }


        actual_sources = tag_sources.get(tag)


        if actual_sources is None:

            warnings.append(

                f"Tag '{tag}' was claimed in "

                f"{sorted(claimed_sources)}, but was not found "

                "in parsed source metadata."

            )

        elif claimed_sources != actual_sources:

            warnings.append(

                f"Tag-source mismatch for '{tag}': "

                f"report lists {sorted(claimed_sources)}, "

                f"actual sources are {sorted(actual_sources)}."

            )


    # 4. Check explicit tag counts when the report uses a recognizable form.

    # Examples: "mirai: 3 records" or "`mirai` appears in 3 records".

    count_patterns = [

        re.compile(

            r"`?([A-Za-z0-9_.-]+)`?\s*:\s*(\d+)\s+records?",

            re.IGNORECASE,

        ),

        re.compile(

            r"`?([A-Za-z0-9_.-]+)`?\s+appears\s+in\s+"

            r"(\d+)\s+records?",

            re.IGNORECASE,

        ),

    ]


    for pattern in count_patterns:

        for match in pattern.finditer(report):

            tag = match.group(1).casefold()

            claimed_count = int(match.group(2))

            actual_count = len(tag_sources.get(tag, set()))


            if tag in tag_sources and claimed_count != actual_count:

                warnings.append(

                    f"Tag-count mismatch for '{tag}': report states "

                    f"{claimed_count}, but parsed metadata shows "

                    f"{actual_count} unique source records."

                )


    # 5. Flag high-risk claims, while avoiding common explicit negations.

    lower_report = report.casefold()


    negation_patterns = (

        r"\bno claim of\b",

        r"\bno evidence to support\b",

        r"\bdoes not support\b",

        r"\bdo not support\b",

        r"\bwithout evidence of\b",

        r"\bnot supported by\b",

        r"\bnot sufficient to establish\b",

        r"\bdoes not prove\b",

        r"\bdo not prove\b",

        r"\bdoes not confirm\b",

        r"\bdo not confirm\b",

        r"\bnot confirmed\b",

        r"\bnot established\b",

        r"\bno evidence (?:of|for)\b",

        r"\bcannot establish\b",

        r"\bcan't establish\b",

        r"\bnot independently verified\b",

        r"\bdoes not establish\b",

        r"\bdoes not demonstrate\b",

        r"\bdoes not imply\b",

        r"\bnot proof of\b",
        r"\bdoes not independently verify\b",
        r"\bdo not independently verify\b",
        r"\bcannot independently verify\b",
        r"\bnot independently confirmed\b",
        r"\bnot evidence of\b",
        r"\bnot evidence that\b",
        r"\bcannot verify\b",
        r"\bcan't verify\b",
        r"\bis not established\b",
        r"\bare not established\b",
        r"\bhas not been established\b",
        r"\bhave not been established\b",
        r"\bwas not confirmed\b",
        r"\bwere not confirmed\b",
        r"\bcannot be confirmed\b",
        r"\bhas not been confirmed\b",
        r"\bhave not been confirmed\b",
    )


    for category, phrases in CAUTION_TERMS.items():

        for phrase in phrases:

            phrase_lower = phrase.casefold()


            for match in re.finditer(

                r"\b" + re.escape(phrase_lower) + r"\b",

                lower_report,

            ):



                # Inspect the sentence containing the flagged claim.
                sentence_start = max(
                    lower_report.rfind(".", 0, match.start()),
                    lower_report.rfind("!", 0, match.start()),
                    lower_report.rfind("?", 0, match.start()),
                    lower_report.rfind("\n", 0, match.start()),
                ) + 1

                sentence_end_candidates = [
                    position
                    for position in (
                        lower_report.find(".", match.end()),
                        lower_report.find("!", match.end()),
                        lower_report.find("?", match.end()),
                        lower_report.find("\n", match.end()),
                    )
                    if position != -1
                ]

                sentence_end = (
                    min(sentence_end_candidates)
                    if sentence_end_candidates
                    else len(lower_report)
                )

                sentence = lower_report[sentence_start:sentence_end]

                # Check both before and after the flagged phrase.
                explicitly_negated = any(

                    re.search(pattern, sentence)

                    for pattern in negation_patterns

                )


                if not explicitly_negated:

                    warnings.append(

                        f"High-risk claim requires analyst review "

                        f"({category}): '{phrase}'."
                    )
                    break

    if not evidence:
        warnings.append("No source evidence was retrieved.")
    warnings = list(dict.fromkeys(warnings))
    return report, warnings


def _append_validation_section(
    report: str,
    evidence: list[dict],
    warnings: list[str],
) -> str:
    lines = [
        "## Automated report validation",
        "",
        "- Citation validation checks whether cited source IDs exist in the "
        "retrieved evidence. It does not prove that each citation semantically "
        "supports the associated claim.",
        "",
    ]

    if warnings:
        lines.append("### Warnings")
        lines.append("")

        for warning in warnings:
            lines.append(f"- {warning}")
    else:
        lines.append("No automated validation warnings were detected.")

    return report.rstrip() + "\n\n" + "\n".join(lines)

def _extract_ai_analysis(report: str) -> str:
    """
    Keep only the Potential relationships and inferences section
    from the LLM response.

    This also supports older LLM responses that contain a full report.
    """
    if not report:
        return "No additional relationships or inferences were generated."

    pattern = (
        r"(?ims)^##\s*Potential relationships and inferences\s*\n"
        r"(.*?)(?=^##\s+|\Z)"
    )

    match = re.search(pattern, report)

    if match:
        analysis = match.group(1).strip()
    else:
        analysis = report.strip()

    # Remove any repeated section heading.
    analysis = re.sub(
        r"(?im)^##\s*Potential relationships and inferences\s*$",
        "",
        analysis,
    ).strip()

    if not analysis:
        return "No additional relationships or inferences were generated."

    return analysis

def _format_graph_context(graph_context: dict) -> str:
    """Format database graph connections as a report section."""

    connections = graph_context.get("connections", [])
    related_documents = graph_context.get("related_documents", [])

    lines = [
        "## Graph-based connections",
        "",
        (
            "The following connections were retrieved from the existing "
            "threat-intelligence relationship graph. They are recorded "
            "relationships, not independent confirmation of attribution "
            "or compromise."
        ),
        "",
    ]

    if not connections:
        lines.extend(
            [
                "No direct graph relationships were found for the "
                "documents retrieved in this investigation.",
                "",
            ]
        )
    else:
        for connection in connections:
            source = connection["source"]
            target = connection["target"]

            source_label = (
                f"{source['type']} `{source['label']}`"
            )
            target_label = (
                f"{target['type']} `{target['label']}`"
            )

            lines.append(
                f"### {source_label} → {target_label}"
            )
            lines.append("")
            lines.append(
                f"- Relationship type: "
                f"`{connection['relationship_type']}`"
            )

            description = connection.get("description")
            if description:
                lines.append(f"- Recorded explanation: {description}")

            confidence = connection.get("confidence")
            if confidence is not None:
                lines.append(
                    f"- Stored relationship score: `{confidence:.2f}`"
                )
            else:
                lines.append("- Stored relationship score: Not available")

            lines.append("")

    if related_documents:
        lines.extend(
            [
                "### Documents represented in graph context",
                "",
            ]
        )

        for document in related_documents:
            lines.append(
                f"- Document {document['document_id']}: "
                f"{document['title']} "
                f"(source: {document['source_name'] or 'Not provided'})"
            )

        lines.append("")

    lines.extend(
        [
            "### Interpretation limitations",
            "",
            "- Relationship scores are evidence-strength heuristics, "
            "not statistical probabilities.",
            "- Shared tags, reporters, URL paths, or dates do not by "
            "themselves establish common ownership or campaign attribution.",
            "- A graph connection does not independently verify malware "
            "execution, successful compromise, or malicious intent.",
            "- Connected documents should be reviewed at their original "
            "source before drawing operational conclusions.",
        ]
    )

    return "\n".join(lines)
@mlflow.trace(name="run_investigation", span_type="CHAIN")
def run_investigation(

    query: str,

    *,

    limit: int = 6,

    document_ids: list[int] | None = None,

) -> dict:

    graph = build_investigation_graph()

    result = graph.invoke({

        "query": query,

        "limit": limit,

        "document_ids": document_ids,

    })

    evidence = result.get("evidence", [])
    ai_analysis = _extract_ai_analysis(result.get("report", ""))

    # Build graph context using the documents retrieved by RAG.
    seed_document_ids = sorted(
        {
            int(item["document_id"])
            for item in evidence
            if item.get("document_id") is not None
        }
    )

    with Session(engine) as session:
        graph_context = build_graph_context(
            session=session,
            document_ids=seed_document_ids,
        )

    graph_context_report = _format_graph_context(graph_context)

    deterministic = build_deterministic_report(evidence)
    

    report = "\n\n".join([
        "## Executive summary",
        deterministic["executive_summary"],

        "## Observed evidence",
        deterministic["observed_evidence"],

        "## Potential relationships and inferences",
        ai_analysis,

        graph_context_report,

        "## Risk indicators",
        deterministic["risk_indicators"],

        "## Evidence gaps and limitations",
        deterministic["evidence_gaps"],

        "## Source-derived statistics",
        deterministic["statistics"],
    ])

    report, validation_warnings = _validate_report(report, evidence)

    report = _append_validation_section(
        report,
        evidence,
        validation_warnings,
)


    # Persist the report and t  he exact passages used by this investigation.

    with Session(engine) as session:

        investigation = Investigation(

            query=query,

            report=report,

            status="completed",

            evidence_count=len(evidence),

            unverified_source_references=sorted(

                set(re.findall(

                    r"\[UNVERIFIED SOURCE REFERENCE: (S\d+)\]",

                    report,

                )),

                key=lambda value: int(value[1:]),

            ),

        )

        session.add(investigation)

        session.flush()


        for item in evidence:

            session.add(InvestigationSource(

                investigation_id=investigation.id,

                source_label=item["source_id"],

                document_id=item["document_id"],

                chunk_id=item["chunk_id"],

                quoted_text=item["chunk_text"],

                start_offset=item["start_offset"],

                end_offset=item["end_offset"],

                retrieval_score=item["score"],

            ))


        session.commit()

        investigation_id = investigation.id

        created_at = (

            investigation.created_at.isoformat()

            if investigation.created_at

            else None

        )


    return {

        "investigation_id": investigation_id,

        "created_at": created_at,

        "query": query,

        "report": report,

        "unverified_source_references": sorted(

            set(re.findall(

                r"\[UNVERIFIED SOURCE REFERENCE: (S\d+)\]",

                report,

            )),

            key=lambda value: int(value[1:]),

        ),

        "validation_warnings": validation_warnings,

        "evidence_count": len(evidence),

        "graph_context": graph_context,

        "sources": [

            {

                "source_id": item["source_id"],

                "document_id": item["document_id"],

                "chunk_id": item["chunk_id"],

                "title": item["document_title"],

                "source_name": item["source_name"],

                "source_url": item["source_url"],

                "external_id": item["external_id"],

                "start_offset": item["start_offset"],

                "end_offset": item["end_offset"],

                "quoted_text": item["chunk_text"],

                "retrieval_score": item["score"],

            }

            for item in evidence

        ],

        "disclaimer": (

            "AI-generated analysis is investigative assistance, not a "

            "definitive attribution or confirmation of compromise. Automated "

            "validation cannot replace analyst review."

        ),

    }
