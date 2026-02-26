/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { Server, Cpu, HardDrive, Zap, XSquare, Globe, CheckCircle, Download, Trash2, LogOut, ShieldCheck, Clock } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

const RAM_OPTIONS = [
  { value: 0.5, label: '512 MB', price: 15000 },
  { value: 1, label: '1 GB', price: 28000 },
  { value: 2, label: '2 GB', price: 35000, bonus: '+ Domain .my.id' },
  { value: 3, label: '3 GB', price: 48000 },
  { value: 4, label: '4 GB', price: 61000 },
  { value: 6, label: '6 GB', price: 87000 },
  { value: 8, label: '8 GB', price: 113000 },
  { value: 16, label: '16 GB', price: 217000 },
];

type View = 'HOME' | 'CHECKOUT' | 'RECEIPT' | 'STATUS' | 'ADMIN_LOGIN' | 'ADMIN_DASHBOARD';

export default function App() {
  const [view, setView] = useState<View>('HOME');
  const [ramIndex, setRamIndex] = useState(1);
  const [cpuCores, setCpuCores] = useState(1);
  const [hasIPv4, setHasIPv4] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    username: '',
    password: '',
    domain: ''
  });
  
  const [orderId, setOrderId] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminCreds, setAdminCreds] = useState({ username: '', password: '' });
  const [confirmData, setConfirmData] = useState({ id: '', ipv6: '', ipv4_addr: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);
  const postPaymentRef = useRef<HTMLDivElement>(null);

  const selectedRam = RAM_OPTIONS[ramIndex];
  const cpuPrice = cpuCores * 5000;
  const ipv4Price = hasIPv4 ? 80000 : 0;
  const totalPrice = selectedRam.price + cpuPrice + ipv4Price;

  // Parallax hooks
  const { scrollY } = useScroll();
  // Move text up slightly and fade it out to prevent overlapping
  const yHeroText = useTransform(scrollY, [0, 500], [0, -50]);
  const opacityHeroText = useTransform(scrollY, [0, 300], [1, 0]);
  
  // Make shapes move up instead of down
  const yShape1 = useTransform(scrollY, [0, 500], [0, -150]);
  const yShape2 = useTransform(scrollY, [0, 500], [0, -80]);

  // Polling for order status
  useEffect(() => {
    // Check for admin panel route only once on mount
    if (window.location.pathname === '/adminpanel' || window.location.pathname === '/adminpanel/') {
      if (!adminAuth) setView('ADMIN_LOGIN');
    }
  }, []);

  useEffect(() => {
    let interval: any;
    if (view === 'STATUS' && orderId) {
      const fetchStatus = async () => {
        try {
          const res = await fetch(`/api/orders/${orderId}`);
          const data = await res.json();
          if (data) {
            setCurrentOrder(data);
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchStatus();
      interval = setInterval(fetchStatus, 5000);
    }
    return () => clearInterval(interval);
  }, [view, orderId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = Math.random().toString(36).substring(2, 10).toUpperCase();
    const orderData = {
      id,
      ...formData,
      ram_label: selectedRam.label,
      ram_price: selectedRam.price,
      cpu_cores: cpuCores,
      cpu_price: cpuPrice,
      has_ipv4: hasIPv4,
      ipv4_price: ipv4Price,
      total_price: totalPrice
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      if (res.ok) {
        setOrderId(id);
        setCurrentOrder(orderData);
        setView('RECEIPT');
      } else {
        const err = await res.json();
        alert('Gagal membuat pesanan: ' + (err.error || 'Terjadi kesalahan di server'));
      }
    } catch (e) {
      console.error(e);
      alert('Gagal membuat pesanan: Terjadi kesalahan koneksi');
    }
  };

  const downloadPDF = (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    const element = ref.current;
    const opt = {
      margin: 10,
      filename: `${filename}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };
    html2pdf().set(opt).from(element).save();
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminCreds)
    });
    if (res.ok) {
      setAdminAuth(true);
      fetchAdminOrders();
      setView('ADMIN_DASHBOARD');
    } else {
      alert('Login Gagal');
    }
  };

  const fetchAdminOrders = async () => {
    const res = await fetch('/api/admin/orders');
    if (res.ok) {
      const data = await res.json();
      setAdminOrders(data);
    }
  };

  const confirmOrder = async () => {
    const res = await fetch(`/api/admin/confirm/${confirmData.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ipv6: confirmData.ipv6, ipv4_addr: confirmData.ipv4_addr })
    });
    if (res.ok) {
      setConfirmData({ id: '', ipv6: '', ipv4_addr: '' });
      fetchAdminOrders();
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`, { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setDeleteConfirmId(null);
        await fetchAdminOrders();
      } else {
        const err = await res.json();
        alert('Gagal menghapus: ' + (err.error || 'Unknown error'));
      }
    } catch (e) {
      console.error(e);
      alert('Terjadi kesalahan koneksi saat menghapus.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAdminAuth(false);
    setView('HOME');
  };

  return (
    <div className="min-h-screen font-sans pb-20">
      {/* Header */}
      <header className="border-b-4 border-black bg-[#FFE600] p-4 sticky top-0 z-50 brutal-shadow-sm">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('HOME')}>
            <div className="bg-black text-[#FFE600] p-1 brutal-border">
              <Zap size={24} />
            </div>
            <h1 className="text-3xl font-bold tracking-tighter uppercase">Rffnet</h1>
          </div>
          <div className="flex gap-4 font-bold uppercase text-sm">
            {view === 'HOME' && (
              <>
                <a href="#pricing" className="hover:underline decoration-4 underline-offset-4 hidden md:block">Pricing</a>
              </>
            )}
            {adminAuth && view === 'ADMIN_DASHBOARD' && (
              <button onClick={handleLogout} className="flex items-center gap-1 bg-[#FF007F] text-white px-3 py-1 brutal-border brutal-shadow-sm text-xs">
                <LogOut size={14} /> Logout
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-12">
        <AnimatePresence mode="wait">
          {view === 'HOME' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-20"
            >
              {/* Hero */}
              <section className="text-center space-y-6 relative py-10">
                {/* Decorative Parallax Shapes */}
                <motion.div style={{ y: yShape1 }} className="hidden md:block absolute top-0 left-10 w-16 h-16 bg-[#FFE600] brutal-border brutal-shadow-sm transform rotate-12"></motion.div>
                <motion.div style={{ y: yShape2 }} className="hidden md:block absolute bottom-0 right-10 w-20 h-20 bg-[#FF007F] brutal-border brutal-shadow-sm rounded-full"></motion.div>
                
                <motion.div style={{ y: yHeroText, opacity: opacityHeroText }} className="relative z-10">
                  <div className="inline-block bg-[#00FFFF] px-4 py-1 brutal-border brutal-shadow-sm mb-4 transform -rotate-2">
                    <span className="font-bold uppercase tracking-widest text-sm">IPv6 Only VPS</span>
                  </div>
                  <h2 className="text-5xl md:text-7xl font-bold uppercase leading-none tracking-tight">
                    Welcome to the <br/>
                    <span className="text-[#FF007F] drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">Future of Web</span>
                  </h2>
                  <p className="text-xl md:text-2xl font-mono max-w-2xl mx-auto bg-white p-4 brutal-border brutal-shadow-sm mt-6">
                    High performance, low cost. Pure IPv6 infrastructure for the modern internet.
                  </p>
                </motion.div>
              </section>

              {/* Configurator */}
              <section id="pricing" className="grid md:grid-cols-2 gap-8">
                <div className="bg-[#FF99CC] p-6 brutal-border brutal-shadow">
                  <h3 className="text-3xl font-bold uppercase mb-6 flex items-center gap-2">
                    <Server /> Build Your VPS
                  </h3>
                  
                  <div className="space-y-8">
                    {/* RAM Slider */}
                    <div className="bg-white p-4 brutal-border">
                      <div className="flex justify-between items-end mb-4">
                        <label className="font-bold uppercase text-lg flex items-center gap-2">
                          <HardDrive size={20} /> RAM Memory
                        </label>
                        <span className="font-mono text-xl font-bold bg-[#FFE600] px-2 brutal-border">
                          {selectedRam.label}
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max={RAM_OPTIONS.length - 1} 
                        step="1" 
                        value={ramIndex}
                        onChange={(e) => setRamIndex(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs font-mono mt-2 font-bold">
                        <span>512MB</span>
                        <span>16GB</span>
                      </div>
                      {selectedRam.value >= 2 && (
                        <div className="mt-4 bg-[#00FFFF] p-2 text-center font-bold uppercase brutal-border text-sm animate-pulse">
                          + FREE DOMAIN .MY.ID
                        </div>
                      )}
                    </div>

                    {/* CPU Slider */}
                    <div className="bg-white p-4 brutal-border">
                      <div className="flex justify-between items-end mb-4">
                        <label className="font-bold uppercase text-lg flex items-center gap-2">
                          <Cpu size={20} /> CPU Cores
                        </label>
                        <span className="font-mono text-xl font-bold bg-[#FFE600] px-2 brutal-border">
                          {cpuCores} Core{cpuCores > 1 ? 's' : ''}
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="8" 
                        step="1" 
                        value={cpuCores}
                        onChange={(e) => setCpuCores(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs font-mono mt-2 font-bold">
                        <span>1 Core</span>
                        <span>8 Cores</span>
                      </div>
                    </div>

                    {/* IPv4 Topping */}
                    <div className="bg-white p-4 brutal-border">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Globe size={20} className="text-[#FF007F]" />
                          <span className="font-bold uppercase text-lg">IPv4 Connection</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={hasIPv4}
                          onChange={(e) => setHasIPv4(e.target.checked)}
                          className="w-6 h-6 brutal-border accent-[#FF007F]"
                        />
                      </label>
                      <p className="text-xs font-mono mt-2 text-gray-600">
                        * Tambahan Rp 80.000 / bulan
                      </p>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-white p-6 brutal-border brutal-shadow flex flex-col justify-between">
                  <div>
                    <h3 className="text-3xl font-bold uppercase mb-6 border-b-4 border-black pb-2">
                      Order Summary
                    </h3>
                    <ul className="space-y-4 font-mono text-lg">
                      <li className="flex justify-between border-b-2 border-dashed border-gray-400 pb-2">
                        <span>RAM ({selectedRam.label})</span>
                        <span className="font-bold">Rp {selectedRam.price.toLocaleString('id-ID')}</span>
                      </li>
                      <li className="flex justify-between border-b-2 border-dashed border-gray-400 pb-2">
                        <span>CPU ({cpuCores} Core)</span>
                        <span className="font-bold">Rp {cpuPrice.toLocaleString('id-ID')}</span>
                      </li>
                      <li className="flex justify-between border-b-2 border-dashed border-gray-400 pb-2">
                        <span>Network</span>
                        <span className="font-bold">{hasIPv4 ? 'IPv6 + IPv4' : 'IPv6 Only'}</span>
                      </li>
                      {hasIPv4 && (
                        <li className="flex justify-between border-b-2 border-dashed border-gray-400 pb-2">
                          <span>IPv4 Topping</span>
                          <span className="font-bold">Rp 80.000</span>
                        </li>
                      )}
                      {selectedRam.value >= 2 && (
                        <li className="flex justify-between border-b-2 border-dashed border-gray-400 pb-2 text-[#FF007F]">
                          <span>Bonus</span>
                          <span className="font-bold">Domain .my.id</span>
                        </li>
                      )}
                    </ul>
                  </div>
                  
                  <div className="mt-8 bg-[#FFE600] p-4 brutal-border text-center">
                    <p className="uppercase font-bold text-sm mb-1">Total Monthly</p>
                    <p className="text-4xl font-bold tracking-tighter">
                      Rp {totalPrice.toLocaleString('id-ID')}
                    </p>
                  </div>

                  <button 
                    onClick={() => setView('CHECKOUT')}
                    className="w-full bg-black text-white text-xl font-bold uppercase py-4 brutal-border brutal-shadow hover:bg-[#FF007F] transition-all mt-6"
                  >
                    Check Out Now
                  </button>
                </div>
              </section>
            </motion.div>
          )}

          {view === 'CHECKOUT' && (
            <motion.div 
              key="checkout"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto bg-[#00FFFF] p-6 md:p-10 brutal-border brutal-shadow"
            >
              <h3 className="text-4xl font-bold uppercase mb-8 text-center">
                User Information
              </h3>
              
              <form onSubmit={handleCheckout} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-bold uppercase text-sm">Nama Pembeli</label>
                    <input 
                      required
                      type="text" 
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full p-3 brutal-border focus:outline-none focus:bg-[#FFE600] transition-colors font-mono"
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-bold uppercase text-sm">Nomor Handphone</label>
                    <input 
                      required
                      type="tel" 
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full p-3 brutal-border focus:outline-none focus:bg-[#FFE600] transition-colors font-mono"
                      placeholder="08123456789"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="font-bold uppercase text-sm">Alamat Email</label>
                  <input 
                    required
                    type="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full p-3 brutal-border focus:outline-none focus:bg-[#FFE600] transition-colors font-mono"
                    placeholder="john@example.com"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6 bg-white p-4 brutal-border mt-4">
                  <div className="space-y-2">
                    <label className="font-bold uppercase text-sm text-[#FF007F]">Username VPS</label>
                    <input 
                      required
                      type="text" 
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      className="w-full p-3 brutal-border focus:outline-none focus:bg-[#FF99CC] transition-colors font-mono"
                      placeholder="root"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-bold uppercase text-sm text-[#FF007F]">Password VPS</label>
                    <input 
                      required
                      type="password" 
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full p-3 brutal-border focus:outline-none focus:bg-[#FF99CC] transition-colors font-mono"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {selectedRam.value >= 2 && (
                  <div className="space-y-2 bg-white p-4 brutal-border">
                    <label className="font-bold uppercase text-sm text-[#00FFFF] bg-black px-1">Nama Domain (.my.id)</label>
                    <div className="flex items-center">
                      <input 
                        required
                        type="text" 
                        name="domain"
                        value={formData.domain}
                        onChange={handleInputChange}
                        className="flex-1 p-3 brutal-border focus:outline-none focus:bg-[#00FFFF] transition-colors font-mono"
                        placeholder="domain-saya"
                      />
                      <span className="p-3 bg-gray-100 brutal-border border-l-0 font-bold">.my.id</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setView('HOME')}
                    className="flex-1 bg-white text-black text-xl font-bold uppercase py-4 brutal-border brutal-shadow hover:bg-gray-200 transition-all"
                  >
                    Back
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] bg-black text-white text-xl font-bold uppercase py-4 brutal-border brutal-shadow hover:bg-[#FF007F] transition-all"
                  >
                    Confirm Order
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {view === 'RECEIPT' && currentOrder && (
            <motion.div 
              key="receipt"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-xl mx-auto space-y-8"
            >
              <div ref={receiptRef} className="bg-white p-8 brutal-border brutal-shadow font-mono">
                <div className="text-center border-b-4 border-black pb-4 mb-6">
                  <h3 className="text-3xl font-bold uppercase tracking-tighter">Rffnet VPS</h3>
                  <p className="text-sm">STRUK PEMBELIAN #{currentOrder.id}</p>
                </div>
                
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span>Nama:</span>
                    <span className="font-bold">{currentOrder.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Email:</span>
                    <span className="font-bold">{currentOrder.email}</span>
                  </div>
                  <div className="border-t-2 border-dashed border-gray-300 pt-4">
                    <div className="flex justify-between">
                      <span>RAM {currentOrder.ram_label}:</span>
                      <span>Rp {currentOrder.ram_price.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CPU {currentOrder.cpu_cores} Core:</span>
                      <span>Rp {currentOrder.cpu_price.toLocaleString('id-ID')}</span>
                    </div>
                    {currentOrder.has_ipv4 && (
                      <div className="flex justify-between">
                        <span>IPv4 Topping:</span>
                        <span>Rp 80.000</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t-4 border-black pt-4 flex justify-between text-xl font-bold">
                    <span>TOTAL:</span>
                    <span>Rp {currentOrder.total_price.toLocaleString('id-ID')}</span>
                  </div>
                </div>

                <div className="mt-8 bg-[#FFE600] p-4 brutal-border text-center space-y-2">
                  <p className="font-bold uppercase">Tata Cara Pembayaran</p>
                  <p className="text-sm">Transfer GoPay ke Admin:</p>
                  <p className="text-xl font-bold">Raffa F</p>
                  <p className="text-2xl font-bold tracking-widest">083848222110</p>
                  <div className="bg-white p-2 brutal-border text-xs mt-2">
                    Kirim screenshot bukti pembayaran ke WhatsApp <br/>
                    <span className="font-bold">083848222110</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => downloadPDF(receiptRef, `Struk-Rffnet-${currentOrder.id}`)}
                  className="flex-1 bg-[#00FFFF] text-black font-bold uppercase py-3 brutal-border brutal-shadow flex items-center justify-center gap-2"
                >
                  <Download size={18} /> Download Struk
                </button>
                <button 
                  onClick={() => setView('STATUS')}
                  className="flex-1 bg-black text-white font-bold uppercase py-3 brutal-border brutal-shadow hover:bg-[#FF007F]"
                >
                  Cek Status VPS
                </button>
              </div>
            </motion.div>
          )}

          {view === 'STATUS' && currentOrder && (
            <motion.div 
              key="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-2xl mx-auto text-center space-y-8"
            >
              {currentOrder.status === 'PENDING' ? (
                <div className="bg-white p-10 brutal-border brutal-shadow space-y-6">
                  <div className="animate-spin inline-block w-16 h-16 border-8 border-black border-t-[#FF007F] rounded-full"></div>
                  <h3 className="text-3xl font-bold uppercase">Menunggu Konfirmasi</h3>
                  <p className="font-mono text-gray-600">
                    Admin sedang memverifikasi pembayaran Anda. <br/>
                    Halaman ini akan otomatis diperbarui setelah dikonfirmasi.
                  </p>
                  <div className="bg-[#FFE600] p-4 brutal-border font-mono text-sm">
                    ID Pesanan: <span className="font-bold">{currentOrder.id}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div ref={postPaymentRef} className="bg-white p-8 brutal-border brutal-shadow text-left font-mono">
                    <div className="flex items-center gap-2 text-green-600 mb-6 font-bold text-2xl uppercase">
                      <CheckCircle size={32} /> VPS AKTIF!
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="font-bold border-b-2 border-black pb-1 uppercase">Spesifikasi</h4>
                        <p>RAM: {currentOrder.ram_label}</p>
                        <p>CPU: {currentOrder.cpu_cores} Core</p>
                        <p>Network: {currentOrder.has_ipv4 ? 'IPv6 + IPv4' : 'IPv6 Only'}</p>
                      </div>
                      <div className="space-y-4">
                        <h4 className="font-bold border-b-2 border-black pb-1 uppercase">Akses Login</h4>
                        <p>User: <span className="bg-gray-100 px-1">{currentOrder.username}</span></p>
                        <p>Pass: <span className="bg-gray-100 px-1">{currentOrder.password}</span></p>
                      </div>
                    </div>

                    <div className="mt-8 p-4 bg-black text-[#00FFFF] brutal-border">
                      <h4 className="font-bold uppercase mb-2">IP Address</h4>
                      <p className="text-lg">IPv6: {currentOrder.ipv6}</p>
                      {currentOrder.ipv4_addr && (
                        <p className="text-lg">IPv4: {currentOrder.ipv4_addr}</p>
                      )}
                    </div>

                    <div className="mt-6 text-xs text-gray-500 flex items-center gap-2">
                      <Clock size={12} /> Berlaku hingga: {new Date(new Date(currentOrder.created_at).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID')}
                    </div>
                  </div>

                  <button 
                    onClick={() => downloadPDF(postPaymentRef, `VPS-Info-Rffnet-${currentOrder.id}`)}
                    className="w-full bg-[#FF007F] text-white font-bold uppercase py-4 brutal-border brutal-shadow flex items-center justify-center gap-2 text-xl"
                  >
                    <Download /> Download Info VPS (PDF)
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {view === 'ADMIN_LOGIN' && (
            <motion.div 
              key="admin-login"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto bg-white p-8 brutal-border brutal-shadow"
            >
              <h3 className="text-3xl font-bold uppercase mb-6 flex items-center gap-2">
                <ShieldCheck /> Admin Login
              </h3>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="font-bold uppercase text-xs">Username</label>
                  <input 
                    type="text"
                    value={adminCreds.username}
                    onChange={(e) => setAdminCreds({...adminCreds, username: e.target.value})}
                    className="w-full p-2 brutal-border font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold uppercase text-xs">Password</label>
                  <input 
                    type="password"
                    value={adminCreds.password}
                    onChange={(e) => setAdminCreds({...adminCreds, password: e.target.value})}
                    className="w-full p-2 brutal-border font-mono"
                  />
                </div>
                <button className="w-full bg-black text-white font-bold uppercase py-3 brutal-border brutal-shadow hover:bg-[#FF007F]">
                  Login
                </button>
              </form>
            </motion.div>
          )}

          {view === 'ADMIN_DASHBOARD' && (
            <motion.div 
              key="admin-dash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <h3 className="text-4xl font-bold uppercase">Admin Dashboard</h3>
              
              <div className="grid gap-6">
                {adminOrders.map((order) => (
                  <div key={order.id} className="bg-white p-6 brutal-border brutal-shadow grid md:grid-cols-4 gap-4 items-center">
                    <div className="space-y-1">
                      <p className="font-bold text-sm uppercase">User Info</p>
                      <p className="font-mono text-xs">{order.name}</p>
                      <p className="font-mono text-xs">{order.phone}</p>
                      <p className="font-mono text-xs">{order.email}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-sm uppercase">VPS Specs</p>
                      <p className="font-mono text-xs">{order.ram_label} / {order.cpu_cores} Core</p>
                      <p className="font-mono text-xs">{order.has_ipv4 ? 'IPv4 Enabled' : 'IPv6 Only'}</p>
                      {order.domain && <p className="font-mono text-xs text-blue-600">Domain: {order.domain}.my.id</p>}
                      <p className="font-bold text-[#FF007F]">Rp {order.total_price.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-sm uppercase">Credentials</p>
                      <p className="font-mono text-[10px]">User: {order.username}</p>
                      <p className="font-mono text-[10px]">Pass: {order.password}</p>
                      <p className="font-bold text-sm uppercase mt-2">Status</p>
                      <span className={`text-[10px] font-bold px-2 py-1 brutal-border ${order.status === 'CONFIRMED' ? 'bg-green-400' : 'bg-yellow-400'}`}>
                        {order.status}
                      </span>
                      {order.status === 'CONFIRMED' && (
                        <p className="text-[10px] font-mono mt-1">Exp: {new Date(new Date(order.created_at).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 relative z-10">
                      {order.status === 'PENDING' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmData({ ...confirmData, id: order.id });
                          }}
                          className="bg-[#00FFFF] text-black font-bold uppercase text-xs py-2 brutal-border brutal-shadow-sm cursor-pointer hover:bg-white transition-colors"
                        >
                          Konfirmasi
                        </button>
                      )}
                      {deleteConfirmId === order.id ? (
                        <div className="flex gap-1">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteOrder(order.id);
                            }}
                            className="flex-1 bg-red-600 text-white font-bold uppercase text-[10px] py-2 brutal-border brutal-shadow-sm cursor-pointer hover:bg-red-700 transition-colors"
                          >
                            Yakin?
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(null);
                            }}
                            className="flex-1 bg-gray-300 text-black font-bold uppercase text-[10px] py-2 brutal-border brutal-shadow-sm cursor-pointer hover:bg-gray-400 transition-colors"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(order.id);
                          }}
                          className="bg-red-500 text-white font-bold uppercase text-xs py-2 brutal-border brutal-shadow-sm flex items-center justify-center gap-1 cursor-pointer hover:bg-red-600 transition-colors"
                        >
                          <Trash2 size={12} /> Hapus
                        </button>
                      )}
                    </div>

                    {/* Confirmation Modal Inline */}
                    {confirmData.id === order.id && (
                      <div className="col-span-full mt-4 p-4 bg-[#FFE600] brutal-border space-y-4">
                        <p className="font-bold uppercase">Input IP Address</p>
                        <div className="grid md:grid-cols-2 gap-4">
                          <input 
                            placeholder="IPv6 Address"
                            value={confirmData.ipv6}
                            onChange={(e) => setConfirmData({...confirmData, ipv6: e.target.value})}
                            className="p-2 brutal-border font-mono text-sm"
                          />
                          {order.has_ipv4 === 1 && (
                            <input 
                              placeholder="IPv4 Address"
                              value={confirmData.ipv4_addr}
                              onChange={(e) => setConfirmData({...confirmData, ipv4_addr: e.target.value})}
                              className="p-2 brutal-border font-mono text-sm"
                            />
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={confirmOrder} className="bg-black text-white px-4 py-2 brutal-border font-bold uppercase text-xs">Simpan & Aktifkan</button>
                          <button onClick={() => setConfirmData({id: '', ipv6: '', ipv4_addr: ''})} className="bg-white px-4 py-2 brutal-border font-bold uppercase text-xs">Batal</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {adminOrders.length === 0 && (
                  <div className="text-center p-10 bg-white brutal-border brutal-shadow font-mono">
                    Belum ada pesanan.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-32 border-t-4 border-black bg-white">
        <div className="bg-[#FFE600] border-b-4 border-black p-2 overflow-hidden whitespace-nowrap flex items-center">
          <motion.div 
            animate={{ x: [0, -1000] }} 
            transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
            className="flex gap-10 font-bold uppercase tracking-widest text-sm"
          >
            <span>⚡ FAST</span>
            <span>🔒 SECURE</span>
            <span>🌐 IPv6 ONLY</span>
            <span>⚡ FAST</span>
            <span>🔒 SECURE</span>
            <span>🌐 IPv6 ONLY</span>
            <span>⚡ FAST</span>
            <span>🔒 SECURE</span>
            <span>🌐 IPv6 ONLY</span>
            <span>⚡ FAST</span>
            <span>🔒 SECURE</span>
            <span>🌐 IPv6 ONLY</span>
          </motion.div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-black text-[#FFE600] p-1 brutal-border">
                <Zap size={24} />
              </div>
              <h2 className="text-2xl font-bold tracking-tighter uppercase">Rffnet</h2>
            </div>
            <p className="font-mono text-sm text-gray-600">
              Penyedia layanan VPS IPv6 Only dengan performa tinggi dan harga terjangkau.
            </p>
          </div>
          <div className="space-y-2 font-bold uppercase text-sm">
            <p className="text-gray-500 mb-4">Links</p>
            <a href="#" onClick={(e) => { e.preventDefault(); setView('HOME'); }} className="block hover:text-[#FF007F] hover:underline decoration-2 underline-offset-4">Home</a>
            <a href="#pricing" onClick={() => setView('HOME')} className="block hover:text-[#FF007F] hover:underline decoration-2 underline-offset-4">Pricing</a>
            <a href="#" className="block hover:text-[#FF007F] hover:underline decoration-2 underline-offset-4">Terms of Service</a>
          </div>
          <div className="space-y-2 font-bold uppercase text-sm">
            <p className="text-gray-500 mb-4">Contact</p>
            <p className="font-mono">WhatsApp: 083848222110</p>
            <p className="font-mono">Email: admin@rffnet.my.id</p>
          </div>
        </div>
        <div className="bg-black text-white text-center p-4 font-mono text-xs uppercase">
          &copy; {new Date().getFullYear()} Rffnet. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
