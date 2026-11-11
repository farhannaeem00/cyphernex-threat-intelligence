import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, UploadCloud, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import api from '../../../services/api'

type UploadedDocument = { id:number; title:string; original_filename:string; file_type:string; status:string; created_at:string|null; sha256_hash:string|null }

export default function Documents() {
  const [items,setItems]=useState<UploadedDocument[]>([])
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [dragging,setDragging]=useState(false)
  const inputRef=useRef<HTMLInputElement>(null)
  const load=useCallback(async()=>{ try { const {data}=await api.get('/api/documents/'); setItems(data.documents ?? []) } catch { setError('Could not load uploaded documents. Check that the backend is running.') } },[])
  useEffect(()=>{ void load() },[load])
  const upload=async(file?:File)=>{
    if(!file) return
    setBusy(true); setError(''); setMessage('Uploading and indexing document…')
    const body=new FormData(); body.append('file',file)
    try {
      const {data}=await api.post('/api/documents/upload',body,{headers:{'Content-Type':'multipart/form-data'},timeout:180000})
      if(data.duplicate) setMessage(`Duplicate detected. Existing document #${data.document.id} was kept.`)
      else if(data.indexing_error) setMessage(`Document #${data.document_id} saved, but indexing failed: ${data.indexing_error}`)
      else setMessage(`Successfully uploaded and indexed ${file.name}.`)
      await load()
    } catch(e:unknown) {
      const detail=(e as {response?:{data?:{detail?:string}}})?.response?.data?.detail
      setError(detail || 'Upload failed. Check file type, size, and backend logs.'); setMessage('')
    } finally { setBusy(false); if(inputRef.current) inputRef.current.value='' }
  }
  return <section className="space-y-6">
    <div><p className="text-sm font-medium text-teal-300">Knowledge base</p><h1 className="mt-1 text-3xl font-bold text-white">Document Upload</h1><p className="mt-2 text-sm text-slate-400">Add PDF, DOCX, and TXT intelligence reports to the searchable RAG knowledge base.</p></div>
    <div onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void upload(e.dataTransfer.files?.[0])}} className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${dragging?'border-teal-300 bg-teal-400/10':'border-slate-700 bg-[#101a2b]'}`}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-400/10"><UploadCloud className="text-teal-300" size={28}/></div>
      <h2 className="mt-4 text-lg font-semibold text-white">Drag and drop a document</h2><p className="mt-2 text-sm text-slate-400">PDF, DOCX or TXT · Maximum 25 MB</p>
      <button disabled={busy} onClick={()=>inputRef.current?.click()} className="mt-5 rounded-lg bg-teal-400 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy?'Processing…':'Choose file'}</button>
      <input ref={inputRef} type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain" className="hidden" onChange={e=>void upload(e.target.files?.[0])}/>
    </div>
    {message && <div className="flex items-start gap-2 rounded-lg border border-teal-400/20 bg-teal-400/5 p-4 text-sm text-teal-200"><CheckCircle2 size={18}/><span className="break-all">{message}</span></div>}
    {error && <div className="flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200"><AlertCircle size={18}/>{error}</div>}
    <div className="rounded-xl border border-slate-800 bg-[#101a2b]">
      <div className="flex items-center justify-between border-b border-slate-800 p-5"><div><h2 className="font-semibold text-white">Uploaded documents</h2><p className="mt-1 text-xs text-slate-500">{items.length} user-uploaded documents</p></div><button onClick={()=>void load()} className="flex items-center gap-2 text-xs text-teal-300"><RefreshCw size={14}/> Refresh</button></div>
      {items.length===0?<p className="p-8 text-center text-sm text-slate-500">No uploaded documents yet.</p>:<div className="divide-y divide-slate-800">{items.map(item=><div key={item.id} className="flex items-center justify-between gap-4 p-4"><div className="flex min-w-0 items-center gap-3"><FileText className="shrink-0 text-teal-300"/><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{item.original_filename}</p><p className="mt-1 text-xs text-slate-500">ID #{item.id} · {item.file_type.toUpperCase()} · {item.created_at?new Date(item.created_at).toLocaleString():'Date unavailable'}</p></div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${item.status==='indexed'?'bg-teal-400/10 text-teal-300':'bg-amber-400/10 text-amber-300'}`}>{item.status}</span></div>)}</div>}
    </div>
  </section>
}
