import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Users, 
  FileText, 
  MessageSquare, 
  User, 
  Search, 
  Upload, 
  Download, 
  Trash2, 
  Send, 
  HelpCircle, 
  LogOut,
  CheckCircle2,
  AlertCircle,
  Plus,
  MessageCircle,
  ChevronRight,
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { User as UserType, Material, StudyGroup, Message } from './types';
import { getHelpResponse } from './services/geminiService';

// --- Components ---

const AnimatedBookCursor = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <motion.div
      className="fixed pointer-events-none z-50 text-indigo-500"
      animate={{ x: mousePos.x + 15, y: mousePos.y + 15 }}
      transition={{ type: 'spring', damping: 20, stiffness: 150, mass: 0.5 }}
    >
      <BookOpen size={24} className="drop-shadow-lg" />
    </motion.div>
  );
};

export default function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);

  // Auth State
  const [authData, setAuthData] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    college: '',
    academic_details: ''
  });

  // App Data State
  const [materials, setMaterials] = useState<Material[]>([]);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<StudyGroup | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAiHelp, setShowAiHelp] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [aiInput, setAiInput] = useState('');

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (user) {
      fetchMaterials();
      fetchGroups();
      socketRef.current = io();
      return () => {
        socketRef.current?.disconnect();
      };
    }
  }, [user]);

  const fetchMaterials = async () => {
    const res = await fetch('/api/materials');
    const data = await res.json();
    setMaterials(data);
  };

  const fetchGroups = async () => {
    const res = await fetch('/api/groups');
    const data = await res.json();
    setGroups(data);
  };

  const handleSignup = async () => {
    setIsLoading(true);
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authData)
    });
    const data = await res.json();
    if (data.success) {
      setUser(data.user);
      setShowAuth(false);
    } else {
      alert(data.message);
    }
    setIsLoading(false);
  };

  const handleLogin = async () => {
    setIsLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authData.email, password: authData.password })
    });
    const data = await res.json();
    if (data.success) {
      setUser(data.user);
      setShowAuth(false);
    } else {
      alert(data.message);
    }
    setIsLoading(false);
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append('userId', user?.id || '');
    
    setIsLoading(true);
    const res = await fetch('/api/materials', {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      fetchMaterials();
      (e.target as HTMLFormElement).reset();
    }
    setIsLoading(false);
  };

  const handleDeleteMaterial = async (id: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      await fetch(`/api/materials/${id}`, { method: 'DELETE' });
      fetchMaterials();
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    const res = await fetch('/api/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, userId: user?.id })
    });
    if (res.ok) {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        setActiveGroup(group);
        setActiveTab('chat');
      }
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const input = (e.target as any).message.value;
    if (!input || !activeGroup || !user) return;

    socketRef.current?.emit('send-message', {
      groupId: activeGroup.id,
      userId: user.id,
      userName: user.name,
      content: input
    });
    (e.target as any).message.value = '';
  };

  useEffect(() => {
    if (activeGroup) {
      fetch(`/api/groups/${activeGroup.id}/messages`)
        .then(res => res.json())
        .then(setMessages);
      
      socketRef.current?.emit('join-group', activeGroup.id);
      
      const handleNewMessage = (msg: Message) => {
        if (msg.group_id === activeGroup.id) {
          setMessages(prev => [...prev, msg]);
        }
      };
      
      socketRef.current?.on('new-message', handleNewMessage);
      return () => {
        socketRef.current?.off('new-message', handleNewMessage);
      };
    }
  }, [activeGroup]);

  const handleAiHelp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;
    
    const userMsg = aiInput;
    setAiMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setAiInput('');
    
    const response = await getHelpResponse(userMsg);
    setAiMessages(prev => [...prev, { role: 'ai', text: response || 'Error' }]);
  };

  if (showAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <AnimatedBookCursor />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md border border-indigo-100"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-200">
              <BookOpen size={32} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">StudySync 📚</h1>
            <p className="text-slate-500 text-center mt-2">
              {authMode === 'login' ? 'Welcome back! Please login 🔑' : 'Join the college material exchange hub 🎓'}
            </p>
          </div>

          <div className="flex gap-4 mb-6 p-1 bg-slate-100 rounded-xl">
            <button 
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${authMode === 'login' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${authMode === 'signup' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
            >
              Sign Up
            </button>
          </div>

          <div className="space-y-4">
            {authMode === 'signup' && (
              <input 
                type="text" placeholder="Full Name 👤" 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={authData.name} onChange={e => setAuthData({...authData, name: e.target.value})}
              />
            )}
            <input 
              type="email" placeholder="College Email 📧" 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={authData.email} onChange={e => setAuthData({...authData, email: e.target.value})}
            />
            {authMode === 'signup' && (
              <input 
                type="tel" placeholder="Mobile Number 📱" 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={authData.mobile} onChange={e => setAuthData({...authData, mobile: e.target.value})}
              />
            )}
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Password 🔒" 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl hover:scale-110 transition-transform"
              >
                {showPassword ? '🐵' : '🙈'}
              </button>
            </div>
            {authMode === 'signup' && (
              <>
                <input 
                  type="text" placeholder="College Name 🏫" 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={authData.college} onChange={e => setAuthData({...authData, college: e.target.value})}
                />
                <textarea 
                  placeholder="Academic Details (e.g., Year, Branch) 📝" 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
                  value={authData.academic_details} onChange={e => setAuthData({...authData, academic_details: e.target.value})}
                />
              </>
            )}
            <button 
              onClick={authMode === 'login' ? handleLogin : handleSignup}
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : (authMode === 'login' ? 'Login 🚀' : 'Sign Up ✨')}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      <AnimatedBookCursor />
      
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3 border-bottom border-slate-100">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <BookOpen size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight">StudySync</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BookOpen },
            { id: 'materials', label: 'Materials', icon: FileText },
            { id: 'my-notes', label: 'My Notes', icon: User },
            { id: 'groups', label: 'Study Groups', icon: Users },
            { id: 'feedback', label: 'Feedback', icon: MessageSquare },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-indigo-50 text-indigo-600 font-semibold' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                {user?.name[0]}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.college}</p>
              </div>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all font-medium"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <h2 className="text-2xl font-bold capitalize">{activeTab.replace('-', ' ')}</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" placeholder="Search materials..." 
                className="pl-10 pr-4 py-2 bg-slate-100 rounded-full border-none focus:ring-2 focus:ring-indigo-500 outline-none w-64 transition-all"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setShowAiHelp(!showAiHelp)}
              className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-100 transition-all"
            >
              <HelpCircle size={20} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 pb-24">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                <div className="col-span-2 space-y-6">
                  <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 text-white shadow-xl shadow-indigo-100">
                    <h3 className="text-3xl font-bold mb-2">Welcome back, {user?.name.split(' ')[0]}! 👋 ✨</h3>
                    <p className="text-indigo-100 max-w-md">Ready to ace your exams? Check out the latest materials shared by your peers. 📖 🎯</p>
                    <div className="mt-6 flex gap-3">
                      <button onClick={() => setActiveTab('materials')} className="bg-white text-indigo-600 px-6 py-2 rounded-full font-semibold hover:bg-indigo-50 transition-all">Browse Notes 📂</button>
                      <button onClick={() => setActiveTab('groups')} className="bg-indigo-500/30 backdrop-blur-md text-white border border-white/20 px-6 py-2 rounded-full font-semibold hover:bg-white/10 transition-all">Join Groups 🤝</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                        <FileText size={24} />
                      </div>
                      <p className="text-3xl font-bold">{materials.length} 📄</p>
                      <p className="text-slate-500 font-medium">Shared Materials</p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                        <Users size={24} />
                      </div>
                      <p className="text-3xl font-bold">{groups.length} 👥</p>
                      <p className="text-slate-500 font-medium">Active Groups</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-full">
                    <h4 className="font-bold mb-4 flex items-center gap-2">
                      <AlertCircle size={18} className="text-indigo-600" />
                      Recent Activity 🔔
                    </h4>
                    <div className="space-y-4">
                      {materials.slice(0, 5).map(m => (
                        <div key={m.id} className="flex gap-3 items-start">
                          <div className="w-2 h-2 bg-indigo-400 rounded-full mt-2 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{m.user_name} uploaded <span className="text-indigo-600">{m.title}</span> 📝</p>
                            <p className="text-xs text-slate-400">{new Date(m.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'materials' && (
              <motion.div 
                key="materials"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">Academic Resources</h3>
                  <button 
                    onClick={() => setActiveTab('my-notes')}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-indigo-700 transition-all"
                  >
                    <Upload size={18} />
                    Upload Note
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {materials.filter(m => 
                    m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    m.subject.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(material => (
                    <div key={material.id} className="bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-xl hover:-translate-y-1 transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <FileText size={24} />
                        </div>
                        <a 
                          href={`/api/materials/download/${material.file_path}`} 
                          download={material.file_name}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        >
                          <Download size={20} />
                        </a>
                      </div>
                      <h4 className="font-bold text-lg mb-1">{material.title}</h4>
                      <p className="text-indigo-600 text-sm font-semibold mb-3">{material.subject}</p>
                      <p className="text-slate-500 text-sm line-clamp-2 mb-4">{material.description}</p>
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold">
                            {material.user_name[0]}
                          </div>
                          <span className="text-xs text-slate-500 font-medium">{material.user_name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                          {new Date(material.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'my-notes' && (
              <motion.div 
                key="my-notes"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              >
                <div className="lg:col-span-1">
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 sticky top-8">
                    <h3 className="text-xl font-bold mb-6">Upload New Material</h3>
                    <form onSubmit={handleUpload} className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Title</label>
                        <input name="title" required type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Subject</label>
                        <input name="subject" required type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
                        <textarea name="description" required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">File Attachment</label>
                        <div className="relative">
                          <input name="file" required type="file" className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
                        </div>
                      </div>
                      <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                      >
                        {isLoading ? <Loader2 className="animate-spin" /> : <><Upload size={20} /> Share Note</>}
                      </button>
                    </form>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <h3 className="text-xl font-bold">Your Uploads</h3>
                  <div className="space-y-4">
                    {materials.filter(m => m.user_id === user?.id).map(material => (
                      <div key={material.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                            <FileText size={24} />
                          </div>
                          <div>
                            <h4 className="font-bold">{material.title}</h4>
                            <p className="text-xs text-slate-500">{material.subject} • {new Date(material.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a 
                            href={`/api/materials/download/${material.file_path}`} 
                            download={material.file_name}
                            className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"
                          >
                            <Download size={20} />
                          </a>
                          <button 
                            onClick={() => handleDeleteMaterial(material.id)}
                            className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {materials.filter(m => m.user_id === user?.id).length === 0 && (
                      <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-300">
                        <p className="text-slate-400">You haven't uploaded any notes yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'groups' && (
              <motion.div 
                key="groups"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">Study Communities</h3>
                  <button 
                    onClick={() => {
                      const name = prompt('Group Name:');
                      const subject = prompt('Subject:');
                      const description = prompt('Description:');
                      if (name && subject && description) {
                        fetch('/api/groups', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name, subject, description, userId: user?.id })
                        }).then(fetchGroups);
                      }
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-indigo-700 transition-all"
                  >
                    <Plus size={18} />
                    Create Group
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {groups.map(group => (
                    <div key={group.id} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                          <Users size={28} />
                        </div>
                        <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                          {group.subject}
                        </span>
                      </div>
                      <h4 className="text-xl font-bold mb-2">{group.name}</h4>
                      <p className="text-slate-500 text-sm mb-6 line-clamp-2">{group.description}</p>
                      <button 
                        onClick={() => handleJoinGroup(group.id)}
                        className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-2xl font-semibold hover:bg-indigo-600 transition-all"
                      >
                        <MessageCircle size={18} />
                        Join Chat
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'chat' && activeGroup && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setActiveTab('groups')} className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-900 transition-all">
                      <ChevronRight size={24} className="rotate-180" />
                    </button>
                    <div>
                      <h3 className="font-bold text-lg">{activeGroup.name}</h3>
                      <p className="text-xs text-indigo-600 font-semibold">{activeGroup.subject}</p>
                    </div>
                  </div>
                  <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold">U{i}</div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.user_id === user?.id ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[70%] p-4 rounded-2xl ${
                        msg.user_id === user?.id 
                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                          : 'bg-white text-slate-900 border border-slate-200 rounded-tl-none shadow-sm'
                      }`}>
                        {msg.user_id !== user?.id && <p className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-60">{msg.user_name}</p>}
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 px-1">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="p-6 border-t border-slate-100 flex gap-3 bg-white">
                  <input 
                    name="message" 
                    autoComplete="off"
                    placeholder="Type your message..." 
                    className="flex-1 px-6 py-3 bg-slate-100 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                  <button type="submit" className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                    <Send size={20} />
                  </button>
                </form>
              </motion.div>
            )}

            {activeTab === 'feedback' && (
              <motion.div 
                key="feedback"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-2xl mx-auto"
              >
                <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm text-center">
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <MessageSquare size={40} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Help us improve StudySync</h3>
                  <p className="text-slate-500 mb-8">Your feedback helps us create a better learning environment for everyone.</p>
                  
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const content = (e.target as any).content.value;
                    if (!content) return;
                    setIsLoading(true);
                    await fetch('/api/feedback', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: user?.id, content })
                    });
                    setIsLoading(false);
                    (e.target as any).reset();
                    alert('Thank you for your feedback!');
                  }} className="space-y-4">
                    <textarea 
                      name="content" 
                      placeholder="Share your thoughts, report a bug, or suggest a feature..." 
                      className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-40 resize-none"
                    />
                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      {isLoading ? <Loader2 className="animate-spin" /> : 'Submit Feedback'}
                    </button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <footer className="h-12 bg-white border-t border-slate-200 flex items-center justify-center text-slate-500 text-sm font-medium shrink-0">
          Developed by sanjaykumar 2026 👨‍💻
        </footer>
      </main>

      {/* AI Help Panel */}
      <AnimatePresence>
        {showAiHelp && (
          <motion.div 
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="fixed right-0 top-0 h-screen w-96 bg-white border-l border-slate-200 shadow-2xl z-40 flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                  <HelpCircle size={24} />
                </div>
                <div>
                  <h3 className="font-bold">StudySync Assistant</h3>
                  <p className="text-[10px] uppercase tracking-widest opacity-80">AI Powered Help</p>
                </div>
              </div>
              <button onClick={() => setShowAiHelp(false)} className="p-2 hover:bg-white/10 rounded-lg transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {aiMessages.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-sm">Ask me anything about how to use StudySync!</p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {['How to upload notes?', 'How to join groups?', 'Where is my profile?'].map(q => (
                      <button 
                        key={q} 
                        onClick={() => setAiInput(q)}
                        className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 px-3 py-2 rounded-full transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {aiMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-slate-100 text-slate-800 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAiHelp} className="p-6 border-t border-slate-100 flex gap-2">
              <input 
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                placeholder="Type your question..." 
                className="flex-1 px-4 py-2 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
              <button type="submit" className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all">
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
