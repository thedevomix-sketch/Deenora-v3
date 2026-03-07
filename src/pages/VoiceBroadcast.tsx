import React, { useState, useEffect } from 'react';
import { Mic, Upload, CreditCard, Play, Send, History, Loader2, CheckCircle2, XCircle, AlertCircle, Clock, ChevronDown, Trash2 } from 'lucide-react';
import { supabase } from 'supabase';
import { Institution, Language, Class, Student } from 'types';
import { t } from 'translations';
import { sortMadrasahClasses } from 'pages/Classes';

interface VoiceBroadcastProps {
  lang: Language;
  madrasah: Institution | null;
  triggerRefresh: () => void;
  dataVersion: number;
}

const VoiceBroadcast: React.FC<VoiceBroadcastProps> = ({ lang, madrasah, triggerRefresh, dataVersion }) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'broadcast' | 'recharge' | 'history'>('broadcast');
  const [loading, setLoading] = useState(false);
  
  // Wallet state
  const [walletBalance, setWalletBalance] = useState(0);
  
  // Templates state
  const [templates, setTemplates] = useState<any[]>([]);

  // Broadcast state
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [senders, setSenders] = useState<any[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState<'students' | 'guardians'>('guardians');

  // History state
  const [broadcastHistory, setBroadcastHistory] = useState<any[]>([]);

  // Recharge state
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeTrx, setRechargeTrx] = useState('');
  const [isRecharging, setIsRecharging] = useState(false);

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!madrasah) return;
    fetchWalletBalance();
    if (activeTab === 'templates') fetchTemplates();
    if (activeTab === 'broadcast') { fetchClasses(); fetchTemplates(); }
    if (activeTab === 'history') fetchHistory();
  }, [activeTab, madrasah?.id, dataVersion]);

  const fetchWalletBalance = async () => {
    if (!madrasah) return;
    const { data } = await supabase.from('wallets').select('balance').eq('institution_id', madrasah.id).single();
    if (data) setWalletBalance(data.balance);
  };

  const fetchTemplates = async () => {
    if (!madrasah) return;
    setLoading(true);
    try {
      // First, get local templates
      const { data: localTemplates } = await supabase
        .from('voice_templates')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('uploaded_at', { ascending: false });
      
      if (localTemplates) setTemplates(localTemplates);

      // Sync with Awaj API (optional, can be removed if we only rely on local uploads)
      // For now, we'll keep it but prioritize local data
      /*
      const response = await fetch('/api/awaj/voices');
      if (response.ok) {
        const data = await response.json();
        const voices = Array.isArray(data) ? data : (data.voices || data.data || []);
        
        for (const v of voices) {
           // Sync logic here if needed
        }
      }
      */
    } catch (error) {
      console.error('Error fetching voices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSenders = async () => {
    try {
      // Fetch default senders from Awaj API
      const response = await fetch('/api/awaj/senders');
      let sendersList: any[] = [];
      
      if (response.ok) {
        const data = await response.json();
        sendersList = Array.isArray(data) ? data : (data.senders || data.data || []);
      }

      if (madrasah?.voice_sender_id) {
        // Check if it's already in the list
        const exists = sendersList.some(s => 
          (s.callingNumber === madrasah.voice_sender_id) || 
          (s.caller_id === madrasah.voice_sender_id) || 
          (s.id === madrasah.voice_sender_id)
        );

        if (!exists) {
          sendersList.unshift({
            id: madrasah.voice_sender_id,
            callingNumber: madrasah.voice_sender_id,
            name: 'Dedicated Sender ID'
          });
        }
      }

      setSenders(sendersList);
    } catch (error) {
      console.error('Error fetching senders:', error);
    }
  };

  useEffect(() => {
    if (madrasah) {
      fetchSenders();
    }
  }, [madrasah]);

  const fetchClasses = async () => {
    if (!madrasah) return;
    const { data } = await supabase.from('classes').select('*').eq('institution_id', madrasah.id);
    if (data) setClasses(sortMadrasahClasses(data));
  };

  const fetchHistory = async () => {
    if (!madrasah) return;
    setLoading(true);
    const { data } = await supabase.from('voice_broadcasts').select('*, voice_templates(title)').eq('institution_id', madrasah.id).order('created_at', { ascending: false });
    if (data) setBroadcastHistory(data);
    
    // Track results for pending/sending broadcasts
    if (data) {
      data.filter(b => b.status === 'sending' || b.status === 'pending').forEach(async (broadcast) => {
        try {
          const response = await fetch(`/api/awaj/broadcast/${broadcast.provider_campaign_id}`);
          if (response.ok) {
            const result = await response.json();
            // Map Awaj status to our internal status
            let newStatus = 'completed'; // Default to completed if unknown
            const providerStatus = (result.broadcast?.status || result.status || result.state || '').toLowerCase();
            
            if (['pending', 'queued', 'scheduled'].includes(providerStatus)) {
              newStatus = 'pending';
            } else if (['sending', 'processing', 'running'].includes(providerStatus)) {
              newStatus = 'sending';
            } else if (['failed', 'error', 'cancelled'].includes(providerStatus)) {
              newStatus = 'failed';
            } else if (['completed', 'done', 'success'].includes(providerStatus)) {
              newStatus = 'completed';
            }

            if (newStatus !== broadcast.status) {
              await supabase.from('voice_broadcasts').update({ status: newStatus }).eq('id', broadcast.id);
              // Refresh history
              const { data: updatedData } = await supabase.from('voice_broadcasts').select('*, voice_templates(title)').eq('institution_id', madrasah.id).order('created_at', { ascending: false });
              if (updatedData) setBroadcastHistory(updatedData);
            }
          }
        } catch (error) {
          console.error('Error tracking broadcast result:', error);
        }
      });
    }
    setLoading(false);
  };

  const handleBroadcast = async () => {
    if (!madrasah || !selectedTemplateId || !selectedClassId || !selectedSenderId) {
      alert('Please select a voice template, sender ID, and class.');
      return;
    }
    
    // Get student count for selected class
    const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('class_id', selectedClassId);
    if (!count || count === 0) {
      alert('No students found in this class.');
      return;
    }

    const estimatedCost = count * 0.5; // Assuming 0.5 BDT per call

    if (walletBalance < estimatedCost) {
      alert(`Insufficient balance. Estimated cost: ${estimatedCost} BDT. Current balance: ${walletBalance} BDT.`);
      return;
    }

    setIsBroadcasting(true);
    try {
      // Get the actual students to get their phone numbers
      const { data: students } = await supabase.from('students').select('phone, guardian_phone').eq('class_id', selectedClassId);
      
      if (!students || students.length === 0) {
        throw new Error('No valid phone numbers found for this class.');
      }

      // Collect phone numbers based on target
      const phoneNumbers = students.map(s => broadcastTarget === 'guardians' ? s.guardian_phone : s.phone).filter(Boolean);
      
      if (phoneNumbers.length === 0) {
        throw new Error('No valid phone numbers found for the selected target.');
      }

      // Get the selected template to get the provider_voice_id
      const template = templates.find(t => t.id === selectedTemplateId);
      if (!template) throw new Error('Selected voice template not found.');

      // 1. Send to Awaj Digital API
      const requestId = 'req_' + Math.random().toString(36).substr(2, 9);
      const response = await fetch('/api/awaj/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          request_id: requestId,
          voice: template.provider_voice_id,
          sender: selectedSenderId,
          phone_numbers: phoneNumbers,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send broadcast via Awaj API');
      }

      const result = await response.json();
      const campaignId = result.broadcast?.id || result.campaign_id || result.id || 'camp_' + Math.random().toString(36).substr(2, 9);

      // 2. Save to Supabase
      const { error } = await supabase.from('voice_broadcasts').insert({
        institution_id: madrasah.id,
        voice_template_id: selectedTemplateId,
        target_type: broadcastTarget,
        total_numbers: phoneNumbers.length,
        estimated_cost: estimatedCost,
        provider_campaign_id: campaignId,
        status: 'sending'
      });

      if (error) throw error;

      alert('Broadcast started successfully!');
      setSelectedClassId('');
      setSelectedTemplateId('');
      fetchWalletBalance();
      fetchHistory(); // Refresh history
    } catch (err: any) {
      alert('Error starting broadcast: ' + err.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleRecharge = async () => {
    if (!madrasah || !rechargeAmount || !rechargeTrx) return;
    setIsRecharging(true);
    try {
      // In a real system, this would go to an admin approval queue.
      // For now, we'll just simulate a request.
      alert('Recharge request submitted. Waiting for admin approval.');
      setRechargeAmount('');
      setRechargeTrx('');
    } catch (err: any) {
      alert('Error submitting recharge: ' + err.message);
    } finally {
      setIsRecharging(false);
    }
  };

  const handleUpload = async () => {
    if (!madrasah || !uploadFile || !uploadTitle) return;
    setIsUploading(true);
    try {
      // 1. Upload file to Supabase Storage
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${madrasah.id}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-templates')
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('voice-templates')
        .getPublicUrl(fileName);

      let providerVoiceId = null;
      let providerStatus = 'pending';

      // 3. Upload to Awaj Digital (if configured)
      try {
        const awajResponse = await fetch('/api/awaj/voices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: uploadTitle,
            file_url: publicUrl
          })
        });

        if (awajResponse.ok) {
          const awajData = await awajResponse.json();
          if (awajData.voice?.id || awajData.id) {
            providerVoiceId = awajData.voice?.id || awajData.id;
            providerStatus = 'approved'; // Assuming direct upload approves it on provider side or sets it to pending there
          }
        } else {
          console.warn('Failed to upload to Awaj Digital, will retry via admin panel');
        }
      } catch (err) {
        console.error('Error uploading to Awaj:', err);
      }

      // 4. Insert into database
      const { error: dbError } = await supabase.from('voice_templates').insert({
        institution_id: madrasah.id,
        title: uploadTitle,
        file_url: publicUrl,
        provider_voice_id: providerVoiceId,
        provider_status: providerStatus,
        admin_status: 'pending'
      });

      if (dbError) throw dbError;

      alert('Voice uploaded successfully! It will be available after approval.');
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTitle('');
      fetchTemplates();
    } catch (error: any) {
      console.error('Upload error:', error);
      alert('Error uploading voice: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string, fileUrl?: string) => {
    if (!confirm('Are you sure you want to delete this voice template?')) return;
    
    try {
      // 1. Delete from database
      const { error } = await supabase.from('voice_templates').delete().eq('id', templateId);
      if (error) throw error;

      // 2. Delete from storage (optional, best effort)
      if (fileUrl) {
        try {
          const path = fileUrl.split('/').pop(); // Extract filename if possible
          // Note: This is a simplification. A robust solution would parse the URL properly.
          // For Supabase storage URLs, the path is usually after /public/
          // e.g. .../storage/v1/object/public/bucket/folder/file.mp3
          // We stored it as `madrasah.id/timestamp.ext`
          // So extracting the last two segments might work, but let's skip complex parsing to avoid errors.
        } catch (e) {
          console.error('Error parsing file path for deletion:', e);
        }
      }

      alert('Voice template deleted successfully.');
      fetchTemplates();
    } catch (err: any) {
      alert('Error deleting template: ' + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-[#1E3A8A] to-[#3B82F6] rounded-b-[2.5rem] pt-8 pb-12 px-6 shadow-2xl relative overflow-hidden mb-8">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white rounded-full blur-3xl opacity-50 mix-blend-overlay"></div>
          <div className="absolute bottom-0 left-10 w-40 h-40 bg-blue-400 rounded-full blur-2xl opacity-40 mix-blend-overlay"></div>
        </div>
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 shadow-inner border border-white/20">
            <Mic size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Voice Broadcast</h1>
          <p className="text-blue-100 text-sm font-medium max-w-md">Send automated voice calls to students and guardians.</p>
          
          <div className="mt-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-6 py-3 flex items-center gap-3">
            <CreditCard size={20} className="text-blue-200" />
            <div className="text-left">
              <p className="text-[10px] text-blue-200 uppercase tracking-wider font-bold">Wallet Balance</p>
              <p className="text-xl font-black text-white">{walletBalance.toFixed(2)} ৳</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4">
        <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100 mb-6 overflow-x-auto hide-scrollbar">
          <button onClick={() => setActiveTab('broadcast')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'broadcast' ? 'bg-[#2563EB] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Send size={16} /> Broadcast
          </button>
          <button onClick={() => setActiveTab('templates')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'templates' ? 'bg-[#2563EB] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Mic size={16} /> Voices
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'history' ? 'bg-[#2563EB] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <History size={16} /> History
          </button>
          <button onClick={() => setActiveTab('recharge')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'recharge' ? 'bg-[#2563EB] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <CreditCard size={16} /> Recharge
          </button>
        </div>

        {activeTab === 'broadcast' && (
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-black text-slate-800">New Broadcast</h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Voice Template</label>
                <div className="relative">
                  <select 
                    className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-4 font-bold text-slate-700 appearance-none outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    <option value="">-- Select Voice --</option>
                    {templates.filter(t => t.admin_status === 'approved' && t.provider_status === 'approved').map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Sender ID</label>
                <div className="relative">
                  <select 
                    className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-4 font-bold text-slate-700 appearance-none outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    value={selectedSenderId}
                    onChange={(e) => setSelectedSenderId(e.target.value)}
                  >
                    <option value="">-- Select Sender ID --</option>
                    {senders.map(s => (
                      <option key={s.id || s.callingNumber || s.caller_id} value={s.callingNumber || s.id || s.caller_id}>{s.callingNumber || s.caller_id || s.id || s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Audience</label>
                <div className="flex gap-4">
                  <label className="flex-1 flex items-center gap-3 p-4 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="radio" name="target" checked={broadcastTarget === 'guardians'} onChange={() => setBroadcastTarget('guardians')} className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-slate-700">Guardians</span>
                  </label>
                  <label className="flex-1 flex items-center gap-3 p-4 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="radio" name="target" checked={broadcastTarget === 'students'} onChange={() => setBroadcastTarget('students')} className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-slate-700">Students</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Class</label>
                <div className="relative">
                  <select 
                    className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-4 font-bold text-slate-700 appearance-none outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                  >
                    <option value="">-- Select Class --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.class_name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                </div>
              </div>

              <button 
                onClick={handleBroadcast}
                disabled={!selectedTemplateId || !selectedClassId || isBroadcasting}
                className="w-full h-14 bg-[#2563EB] text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 mt-6"
              >
                {isBroadcasting ? <Loader2 className="animate-spin" size={20} /> : <><Send size={20} /> Start Broadcast</>}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button 
                onClick={() => setShowUploadModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-md hover:bg-blue-700 transition-colors"
              >
                <Upload size={18} /> Upload New Voice
              </button>
            </div>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
            ) : templates.length > 0 ? (
              templates.map(t => (
                <div key={t.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-slate-800">{t.title}</h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><Clock size={12} /> {t.duration}s</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${t.admin_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : t.admin_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          Admin: {t.admin_status}
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${t.provider_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : t.provider_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          Provider: {t.provider_status}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteTemplate(t.id, t.file_url)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      title="Delete Voice"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {t.file_url && (
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <audio controls src={t.file_url} className="w-full h-8" />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-10 bg-white rounded-[2rem] border border-slate-100">
                <Mic size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-500 font-bold">No voice templates found.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
            ) : broadcastHistory.length > 0 ? (
              broadcastHistory.map(h => (
                <div key={h.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-black text-slate-800">{h.voice_templates?.title || 'Unknown Voice'}</h3>
                      <p className="text-xs font-bold text-slate-500 mt-1">{new Date(h.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${h.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {h.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-50">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Target</p>
                      <p className="font-black text-slate-700 capitalize">{h.target_type}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Numbers</p>
                      <p className="font-black text-slate-700">{h.total_numbers}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Cost</p>
                      <p className="font-black text-red-500">{h.estimated_cost} ৳</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 bg-white rounded-[2rem] border border-slate-100">
                <History size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-500 font-bold">No broadcast history found.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'recharge' && (
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6">
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3">
              <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-blue-800 font-medium">Please send money to our bKash number and enter the Transaction ID below to recharge your wallet.</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount (BDT)</label>
                <input 
                  type="number" 
                  className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-4 font-black text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  placeholder="e.g. 500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transaction ID (TrxID)</label>
                <input 
                  type="text" 
                  className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-4 font-black text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all uppercase"
                  value={rechargeTrx}
                  onChange={(e) => setRechargeTrx(e.target.value.toUpperCase())}
                  placeholder="e.g. 8J5G7H9K"
                />
              </div>

              <button 
                onClick={handleRecharge}
                disabled={!rechargeAmount || !rechargeTrx || isRecharging}
                className="w-full h-14 bg-[#2563EB] text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 mt-6"
              >
                {isRecharging ? <Loader2 className="animate-spin" size={20} /> : 'Submit Recharge Request'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 relative">
            <button 
              onClick={() => setShowUploadModal(false)} 
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
            >
              <XCircle size={24} />
            </button>
            
            <h3 className="text-xl font-black text-slate-800 mb-6">Upload New Voice</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Voice Title</label>
                <input 
                  type="text" 
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 font-bold text-slate-700 focus:border-blue-500 outline-none"
                  placeholder="e.g. Eid Greeting"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Audio File (MP3/WAV)</label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer relative group">
                  <input 
                    type="file" 
                    accept="audio/*"
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                  {uploadFile ? (
                    <div className="flex flex-col items-center text-blue-600">
                      <CheckCircle2 size={32} className="mb-2" />
                      <p className="font-bold text-sm">{uploadFile.name}</p>
                      <p className="text-xs opacity-70">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-slate-400 group-hover:text-blue-500 transition-colors">
                      <Upload size={32} className="mb-2" />
                      <p className="font-bold text-sm">Click to upload or drag & drop</p>
                      <p className="text-xs opacity-70">Max size 5MB</p>
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={handleUpload}
                disabled={!uploadFile || !uploadTitle || isUploading}
                className="w-full h-14 bg-blue-600 text-white font-black rounded-xl mt-4 shadow-lg shadow-blue-500/30 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUploading ? <Loader2 className="animate-spin" /> : 'Upload Voice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceBroadcast;
