
import json
from collections import Counter, defaultdict
from urllib.parse import urlsplit


def parse_source_payload(text: str) -> dict | None:
    """Parse a source JSON payload from a retrieved evidence passage."""
    if not isinstance(text, str) or not text.strip():
        return None

    try:
        payload = json.loads(text)
        return payload if isinstance(payload, dict) else None
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end <= start:
        return None

    try:
        payload = json.loads(text[start:end + 1])
        return payload if isinstance(payload, dict) else None
    except json.JSONDecodeError:
        return None


def collect_records(evidence: list[dict]) -> list[dict]:
    """Extract and deduplicate source records."""
    records = {}

    for index, item in enumerate(evidence, start=1):
        payload = parse_source_payload(item.get("chunk_text", ""))

        if not payload:
            continue

        source_id = item.get("source_id") or f"S{index}"
        external_id = payload.get("id")
        key = str(external_id) if external_id is not None else source_id

        records[key] = {
            "source_id": source_id,
            "payload": payload,
        }

    return list(records.values())


def _cell(value) -> str:
    if value is None or value == "":
        return "Not provided"

    return (
        str(value)
        .replace("|", r"\|")
        .replace("\n", " ")
        .replace("\r", " ")
        .strip()
    )


def _safe_url_link(value) -> str:
    """Only create Markdown links for absolute HTTP(S) URLs."""
    if not isinstance(value, str):
        return "Not provided"

    value = value.strip()

    try:
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return _cell(value)
    except ValueError:
        return _cell(value)

    return f"[Open URL]({value.replace(')', '%29')})"


def build_executive_summary(records: list[dict]) -> str:
    if not records:
        return (
            "No parseable source records were available. "
            "The investigation cannot establish findings from the retrieved evidence."
        )

    ids = [
        str(record["payload"].get("id", "Not provided"))
        for record in records
    ]

    threats = Counter(
        str(record["payload"]["threat"])
        for record in records
        if record["payload"].get("threat")
    )

    lines = [
        f"{len(records)} unique source records were examined: "
        + ", ".join(ids) + "."
    ]

    if threats:
        classifications = ", ".join(
            f"{name}: {count} record(s)"
            for name, count in sorted(threats.items())
        )
        lines.append(
            "Source-recorded threat classifications: "
            + classifications + "."
        )

    lines.append(
        "These findings describe source-reported metadata. "
        "They do not independently establish payload behavior, "
        "malware execution, compromise, common ownership, or campaign attribution."
    )

    return "\n\n".join(lines)


def build_observed_evidence(records: list[dict]) -> str:
    headers = [
        "Record", "Host", "URL", "Status",
        "Blacklists", "Reporter", "Tags", "Threat", "Source"
    ]

    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(headers)) + " |",
    ]

    for record in records:
        payload = record["payload"]
        blacklists = payload.get("blacklists", {})
        tags = payload.get("tags", [])

        blacklist_text = (
            "; ".join(
                f"{key}={value}"
                for key, value in sorted(blacklists.items())
            )
            if isinstance(blacklists, dict) and blacklists
            else "Not provided"
        )

        tags_text = (
            ", ".join(str(tag) for tag in tags)
            if isinstance(tags, list) and tags
            else "Not provided"
        )

        row = [
            _cell(payload.get("id")),
            _cell(payload.get("host")),
            _safe_url_link(payload.get("url")),
            _cell(payload.get("url_status")),
            _cell(blacklist_text),
            _cell(payload.get("reporter")),
            _cell(tags_text),
            _cell(payload.get("threat")),
            _cell(f"[{record['source_id']}]"),
        ]

        lines.append("| " + " | ".join(row) + " |")

    if not records:
        return "No parseable source records were available."

    return "\n".join(lines)


def build_relationship_analysis(records: list[dict]) -> str:
    """Report exact metadata overlaps without claiming technical attribution."""
    tag_sources = defaultdict(list)
    reporter_sources = defaultdict(list)

    for record in records:
        payload = record["payload"]
        source_id = record["source_id"]

        tags = payload.get("tags", [])
        if isinstance(tags, list):
            for tag in tags:
                if isinstance(tag, str) and tag.strip():
                    tag_sources[tag.strip().casefold()].append(source_id)

        reporter = payload.get("reporter")
        if reporter:
            reporter_sources[str(reporter)].append(source_id)

    lines = []

    shared_tags = {
        tag: sources
        for tag, sources in tag_sources.items()
        if len(sources) > 1
    }

    if shared_tags:
        lines.append("### Repeated source-reported tags")
        for tag, sources in sorted(shared_tags.items()):
            lines.append(
                f"- `{tag}` appears in: "
                + ", ".join(f"[{source}]" for source in sources)
                + "."
            )
        lines.append(
            "These overlaps establish shared recorded metadata only. "
            "They do not establish common payloads, operators, or campaigns."
        )
    else:
        lines.append("No repeated tags were found in the parsed records.")

    shared_reporters = {
        reporter: sources
        for reporter, sources in reporter_sources.items()
        if len(sources) > 1
    }

    if shared_reporters:
        lines.append("\n### Reporter overlap")
        for reporter, sources in sorted(shared_reporters.items()):
            lines.append(
                f"- `{reporter}` appears in "
                + ", ".join(f"[{source}]" for source in sources)
                + "."
            )
        lines.append(
            "Reporter overlap does not establish coordination or common ownership."
        )

    return "\n".join(lines)


def build_risk_indicators(records: list[dict]) -> str:
    if not records:
        return "No source records were available to assess."

    lines = []

    threats = Counter(
        str(record["payload"]["threat"])
        for record in records
        if record["payload"].get("threat")
    )

    statuses = Counter(
        str(record["payload"]["url_status"])
        for record in records
        if record["payload"].get("url_status")
    )

    for threat, count in sorted(threats.items()):
        lines.append(
            f"- URLhaus source-reported classification `{threat}`: "
            f"{count} record(s). This is a feed classification, "
            "not independent payload verification."
        )

    for status, count in sorted(statuses.items()):
        lines.append(
            f"- Recorded URL status `{status}`: {count} record(s). "
            "This does not establish current reachability."
        )

    return "\n".join(lines) if lines else "No risk metadata was available."


def build_statistics(records: list[dict], evidence_count: int) -> str:
    lines = [
        f"- Retrieved evidence passages: {evidence_count}.",
        f"- Unique parseable source records: {len(records)}.",
    ]

    for field, heading in [
        ("threat", "Threat classifications"),
        ("url_status", "Recorded URL statuses"),
        ("reporter", "Reporters"),
    ]:
        counts = Counter(
            str(record["payload"][field])
            for record in records
            if record["payload"].get(field)
        )

        if counts:
            lines.append(f"\n- {heading}:")
            for name, count in counts.most_common():
                lines.append(f"  - `{name}`: {count} record(s).")

    tag_counts = Counter()

    for record in records:
        tags = record["payload"].get("tags", [])
        if isinstance(tags, list):
            tag_counts.update(
                tag.strip().casefold()
                for tag in tags
                if isinstance(tag, str) and tag.strip()
            )

    if tag_counts:
        lines.append("\n- Source-reported tags:")
        for tag, count in tag_counts.most_common():
            lines.append(f"  - `{tag}`: {count} record(s).")

    return "\n".join(lines)


def build_evidence_gaps(records: list[dict]) -> str:
    gaps = []

    if not records:
        return (
            "- No parseable source records were available.\n"
            "- Source metadata could not be independently assessed."
        )

    if any(not record["payload"].get("url") for record in records):
        gaps.append("- One or more records do not provide a URL.")

    if any(not record["payload"].get("tags") for record in records):
        gaps.append("- One or more records do not provide source-reported tags.")

    gaps.extend([
        "- Payload contents have not been independently analyzed.",
        "- Malware execution and victim impact are not established.",
        "- Common ownership and campaign attribution are not established.",
        "- Current URL reachability has not been independently checked.",
        "- Source-reported tags have not been independently verified.",
    ])

    return "\n".join(dict.fromkeys(gaps))


def build_deterministic_report(evidence: list[dict]) -> dict:
    """Build factual report sections exclusively from retrieved source records."""
    records = collect_records(evidence)

    return {
        "records": records,
        "executive_summary": build_executive_summary(records),
        "observed_evidence": build_observed_evidence(records),
        "relationships": build_relationship_analysis(records),
        "risk_indicators": build_risk_indicators(records),
        "statistics": build_statistics(records, len(evidence)),
        "evidence_gaps": build_evidence_gaps(records),
    }
