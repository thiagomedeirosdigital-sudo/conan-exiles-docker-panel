'use client';

import MaintenanceManager from './components/MaintenanceManager';

import UpdatesManager from './components/UpdatesManager';

import DashboardSummary from './components/DashboardSummary';
import NetworkStatus from './components/NetworkStatus';


import ModsManager from './components/ModsManager';

import { useEffect, useState } from 'react';
import BackupManager from './components/BackupManager';
import ExternalPortTestCard from "./components/ExternalPortTestCard";

export default function HomePage() {
    const [activeTab, setActiveTab] = useState<'dash' | 'logs' | 'alerts' | 'backups' | 'updates' | 'mods' | 'maintenance'>('dash');
    const [loading, setLoading] = useState(true);
    const [powerLoading, setPowerLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateResult, setUpdateResult] = useState<any>(null);

    // Estados de Dados do Dashboard
    const [serverName, setServerName] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [rconPassword, setRconPassword] = useState('');
    const [adminPasswordConfigured, setAdminPasswordConfigured] = useState(false);
    const [rconPasswordConfigured, setRconPasswordConfigured] = useState(false);
    const [maxPlayers, setMaxPlayers] = useState(20);
    const [serverRegion, setServerRegion] = useState('4');
    const [maxNudity, setMaxNudity] = useState('2');
    const [nudityLevel, setNudityLevel] = useState('2');
    const [mods, setMods] = useState<string[]>([]);
    const [modsDetalhados, setModsDetalhados] = useState<any[]>([]);
    const [modsLoading, setModsLoading] = useState(false);
    const [novoModId, setNovoModId] = useState('');
    const [textoRcon, setTextoRcon] = useState('');
    const [privacyMode, setPrivacyMode] = useState(false);

    // Estado de Alertas Customizados
    const [restartAtivo, setRestartAtivo] = useState(false);
    const [horaRestart, setHoraRestart] = useState('03:00');
    const [tempoAviso1, setTempoAviso1] = useState(10);
    const [mensagem1, setMensagem1] = useState('');
    const [tempoAviso2, setTempoAviso2] = useState(5);
    const [mensagem2, setMensagem2] = useState('');

    // Estado de Logs e Live Monitor
    const [serverLogs, setServerLogs] = useState('Carregando terminal...');
    const [stats, setStats] = useState({ status: 'Carregando...', cpu: '0.0', ram: { percent: '0', used: '0', total: '0' } });

    useEffect(() => {
        // Carga paralela inicial
        Promise.all([
            fetch('/api/config').then(res => res.json()),
            fetch('/api/alerts').then(res => res.json())
        ]).then(([configData, alertData]) => {
            setServerName(configData.serverName);
            setAdminPassword('');
            setRconPassword('');
            setAdminPasswordConfigured(Boolean(configData.adminPasswordConfigured));
            setRconPasswordConfigured(Boolean(configData.rconPasswordConfigured));
            setMaxPlayers(configData.maxPlayers);
            setServerRegion(configData.serverRegion || '4');
            setMaxNudity(configData.maxNudity || '2');
            setNudityLevel(configData.nudityLevel || configData.maxNudity || '2');
            setMods(configData.mods || []);

            setRestartAtivo(Boolean(alertData.restartAtivo));
            setHoraRestart(alertData.horaRestart || '03:00');
            setTempoAviso1(alertData.tempoAviso1);
            setMensagem1(alertData.mensagem1);
            setTempoAviso2(alertData.tempoAviso2);
            setMensagem2(alertData.mensagem2);

            setLoading(false);
        }).catch(() => setLoading(false));

        // Loop de monitoramento de Hardware (3s)
        const interval = setInterval(() => {
            fetch('/api/stats')
                .then(res => res.json())
                .then(data => setStats(data))
                .catch(() => setStats(prev => ({ ...prev, status: 'Offline' })));
        }, 3000);

    
    const carregarModsDetalhados = async () => {
        setModsLoading(true);

        try {
            const res = await fetch('/api/mods');
            const data = await res.json();

            if (data.success && Array.isArray(data.mods)) {
                setModsDetalhados(data.mods);
                setMods(data.mods.map((m: any) => String(m.modId)));
            } else {
                setFeedback({ tipo: 'erro', texto: data.error || 'Erro ao carregar nomes dos mods.' });
            }
        } catch {
            setFeedback({ tipo: 'erro', texto: 'Erro de comunicação ao carregar mods.' });
        } finally {
            setModsLoading(false);
        }
    };

    const moverModDetalhado = (index: number, direction: 'up' | 'down') => {
        setModsDetalhados(prev => {
            const arr = [...prev];
            const target = direction === 'up' ? index - 1 : index + 1;

            if (target < 0 || target >= arr.length) return prev;

            const temp = arr[index];
            arr[index] = arr[target];
            arr[target] = temp;

            return arr.map((m, i) => ({ ...m, order: i + 1 }));
        });
    };

    const salvarOrdemModsDetalhados = async () => {
        const listaAtual = modsDetalhados.map((m: any) => String(m.modId));

        if (!listaAtual.length) {
            setFeedback({ tipo: 'erro', texto: 'Nenhum mod detalhado carregado. Clique em Recarregar nomes primeiro.' });
            return;
        }

        setModsLoading(true);

        try {
            const res = await fetch('/api/mods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save-order', modIds: listaAtual })
            });

            const data = await res.json();

            if (data.success) {
                setModsDetalhados(data.mods || []);
                setMods(listaAtual);
                setFeedback({ tipo: 'sucesso', texto: data.message || 'Ordem dos mods salva. Use Reinício Seguro para aplicar.' });
            } else {
                setFeedback({ tipo: 'erro', texto: data.error || 'Erro ao salvar ordem dos mods.' });
            }
        } catch {
            setFeedback({ tipo: 'erro', texto: 'Erro de comunicação ao salvar ordem dos mods.' });
        } finally {
            setModsLoading(false);
        }
    };
    return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const updatePrivacy = () => {
            setPrivacyMode(localStorage.getItem('conanPrivacyMode') === '1');
        };

        updatePrivacy();

        window.addEventListener('storage', updatePrivacy);
        window.addEventListener('conan-privacy-change', updatePrivacy);

        return () => {
            window.removeEventListener('storage', updatePrivacy);
            window.removeEventListener('conan-privacy-change', updatePrivacy);
        };
    }, []);

    // Monitor de Logs dinâmico quando a aba Logs é selecionada
    useEffect(() => {
        if (activeTab === 'logs') {
            setServerLogs('Buscando logs recentes...');
            fetch('/api/logs')
                .then(res => res.json())
                .then(data => setServerLogs(data.logs));
        }
    }, [activeTab]);

    // Execução de Ligar / Desligar / Reiniciar Container
    const handlePower = async (acao: 'start' | 'stop' | 'restart') => {
        setFeedback({
            tipo: 'erro',
            texto: `Comando ${acao.toUpperCase()} direto está bloqueado por segurança. Use o Reinício Seguro.`
        });
    };

    const handleSafeRestart = async () => {
        if (!confirm('Deseja executar o REINÍCIO SEGURO?\n\nO painel irá parar o Conan, criar backup pré-reinício e iniciar novamente.')) return;

        setPowerLoading(true);
        setFeedback({ tipo: 'sucesso', texto: 'Executando reinício seguro. Aguarde...' });

        try {
            const res = await fetch('/api/safe-restart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await res.json();

            if (data.success) {
                setFeedback({
                    tipo: 'sucesso',
                    texto: `${data.message} Backup criado: ${data.backup}. Aguarde alguns minutos para o servidor terminar de subir.`
                });
            } else {
                setFeedback({
                    tipo: 'erro',
                    texto: `${data.error || 'Falha no reinício seguro.'} ${data.details || ''}`
                });
            }
        } catch {
            setFeedback({ tipo: 'erro', texto: 'Erro de comunicação ao executar reinício seguro.' });
        } finally {
            setPowerLoading(false);
        }
    };

    const salvarConfiguracoes = async (updatedMods?: string[]) => {
        const listaMods = updatedMods !== undefined ? updatedMods : mods;
        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverName, adminPassword, rconPassword, maxPlayers, serverRegion, maxNudity, nudityLevel, mods: listaMods }),
            });
            const data = await res.json();
            if (res.ok) setFeedback({ tipo: 'sucesso', texto: data.message || 'Configurações atualizadas em .env e ServerSettings.ini. Reinicie o Conan para aplicar tudo.' });
            else setFeedback({ tipo: 'erro', texto: data.error || 'Falha ao salvar configurações.' });
        } catch {
            setFeedback({ tipo: 'erro', texto: 'Falha ao salvar configurações.' });
        }
    };


    const verificarUpdatesAgora = async () => {
        setUpdateLoading(true);
        setUpdateResult(null);
        setFeedback(null);

        try {
            const res = await fetch('/api/updates');
            const data = await res.json();
            setUpdateResult(data);

            if (data.success) {
                setFeedback({
                    tipo: 'sucesso',
                    texto: data.updatesFound
                        ? `Updates encontrados: ${data.changedMods?.length || 0} mod(s).`
                        : 'Nenhum update de mod encontrado no momento.'
                });
            } else {
                setFeedback({ tipo: 'erro', texto: data.error || 'Erro ao verificar updates.' });
            }
        } catch {
            setFeedback({ tipo: 'erro', texto: 'Erro de comunicação ao verificar updates.' });
        } finally {
            setUpdateLoading(false);
        }
    };

    const atualizarAgoraComSeguranca = async () => {
        if (!confirm('Deseja executar ATUALIZAÇÃO SEGURA agora?\n\nO painel enviará aviso RCON, aguardará 2 minutos, criará backup e reiniciará o Conan para atualizar jogo/mods.')) return;

        setUpdateLoading(true);
        setFeedback({ tipo: 'sucesso', texto: 'Atualização segura iniciada. Aguarde o processo finalizar...' });

        try {
            const res = await fetch('/api/updates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update-now' })
            });

            const data = await res.json();
            setUpdateResult(data);

            if (data.success) {
                setFeedback({
                    tipo: 'sucesso',
                    texto: `${data.message || 'Atualização segura executada.'} Backup: ${data.backup || 'não informado'}`
                });
            } else {
                setFeedback({ tipo: 'erro', texto: data.error || 'Erro ao executar atualização segura.' });
            }
        } catch {
            setFeedback({ tipo: 'erro', texto: 'Erro de comunicação ao executar atualização segura.' });
        } finally {
            setUpdateLoading(false);
        }
    };

    const salvarAlertas = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restartAtivo, horaRestart, tempoAviso1, mensagem1, tempoAviso2, mensagem2 })
            });
            const data = await res.json();
            if (res.ok) setFeedback({ tipo: 'sucesso', texto: data.message || 'Configuração de restart seguro salva com sucesso!' });
            else setFeedback({ tipo: 'erro', texto: data.error || 'Falha ao salvar cronograma.' });
                } catch {
            setFeedback({ tipo: 'erro', texto: 'Falha ao salvar cronograma.' });
        }
    };

    const enviarRcon = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!textoRcon.trim()) return;
        try {
            const res = await fetch('/api/rcon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mensagem: textoRcon }),
            });
            const data = await res.json();
            setFeedback({ tipo: data.success ? 'sucesso' : 'erro', texto: data.success ? 'Broadcast RCON enviado com sucesso!' : data.error });
            if (data.success) setTextoRcon('');
        } catch {
            setFeedback({ tipo: 'erro', texto: 'Erro ao disparar RCON.' });
        }
    };

    if (loading) return <div style={{ background: '#111', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><h2>Iniciando Painel de Controle ISKAGAMES...</h2></div>

    return (
        <div style={{ padding: '30px', fontFamily: 'sans-serif', backgroundColor: '#111', color: '#fff', minHeight: '100vh' }}>
            
            {/* TOP DE COMANDO E ENERGIA */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '20px' }}>
                <div>
                    <h1 style={{ margin: 0, color: '#f39c12' }}>ISKAGAMES CONTROL</h1>
                    <p style={{ margin: '5px 0 0', color: '#888' }}>Gerenciamento Unificado • Linux Docker Engine</p>
                </div>

                {/* CONTROLES SEGUROS DO SERVIDOR */}
                <div style={{ display: 'flex', gap: '10px', backgroundColor: '#1e1e1e', padding: '10px 15px', borderRadius: '6px', border: '1px solid #333', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#aaa', marginRight: '5px' }}>CONTROLE SEGURO:</span>

                    <button
                        onClick={handleSafeRestart}
                        disabled={powerLoading}
                        style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: powerLoading ? '#555' : '#16a34a', color: '#fff', fontWeight: 'bold', cursor: powerLoading ? 'wait' : 'pointer' }}
                    >
                        {powerLoading ? 'PROCESSANDO...' : '🛡️ REINÍCIO SEGURO'}
                    </button>

                    <button onClick={() => handlePower('start')} disabled={powerLoading} title="Bloqueado por segurança" style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: '#555', color: '#bbb', fontWeight: 'bold', cursor: 'not-allowed' }}>LIGAR</button>
                    <button onClick={() => handlePower('stop')} disabled={powerLoading} title="Bloqueado por segurança" style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: '#555', color: '#bbb', fontWeight: 'bold', cursor: 'not-allowed' }}>DESLIGAR</button>
                    <button onClick={() => handlePower('restart')} disabled={powerLoading} title="Bloqueado por segurança" style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: '#555', color: '#bbb', fontWeight: 'bold', cursor: 'not-allowed' }}>REINICIAR</button>
                </div>

                {/* TELEMETRIA */}
                <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ background: '#1e1e1e', padding: '10px 15px', borderRadius: '6px', border: '1px solid #333', textAlign: 'center' }}>
                        <strong style={{ color: stats.status === 'Online' ? '#2ecc71' : '#e74c3c', display: 'block', fontSize: '14px' }}>{stats.status.toUpperCase()}</strong>
                    </div>
                    <div style={{ background: '#1e1e1e', padding: '10px 15px', borderRadius: '6px', border: '1px solid #333', width: '120px' }}>
                        <span style={{ color: '#888', fontSize: '11px' }}>CPU XEON: {stats.cpu}%</span>
                        <div style={{ background: '#333', height: '4px', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                            <div style={{ background: '#f39c12', height: '100%', width: `${Math.min(parseFloat(stats.cpu), 100)}%` }} />
                        </div>
                    </div>
                    <div style={{ background: '#1e1e1e', padding: '10px 15px', borderRadius: '6px', border: '1px solid #333', width: '130px' }}>
                        <span style={{ color: '#888', fontSize: '11px' }}>RAM: {stats.ram.used}G / {stats.ram.total}G</span>
                        <div style={{ background: '#333', height: '4px', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                            <div style={{ background: '#2ecc71', height: '100%', width: `${stats.ram.percent}%` }} />
                        </div>
                    </div>
                </div>
            </header>

            {/* FEEDBACK POPUP */}
            {feedback && (
                <div style={{ padding: '12px', borderRadius: '6px', marginBottom: '20px', backgroundColor: feedback.tipo === 'sucesso' ? '#1b5e20' : '#b71c1c', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {feedback.texto}
                </div>
            )}

            {/* NAVEGAÇÃO POR ABAS */}
            <nav style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
                <button onClick={() => setActiveTab('dash')} style={{ padding: '10px 20px', borderRadius: '4px', border: 'none', backgroundColor: activeTab === 'dash' ? '#f39c12' : '#222', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Dashboard</button>
                <button onClick={() => setActiveTab('logs')} style={{ padding: '10px 20px', borderRadius: '4px', border: 'none', backgroundColor: activeTab === 'logs' ? '#f39c12' : '#222', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Logs</button>
                <button onClick={() => setActiveTab('alerts')} style={{ padding: '10px 20px', borderRadius: '4px', border: 'none', backgroundColor: activeTab === 'alerts' ? '#f39c12' : '#222', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Alertas</button>
                <button onClick={() => setActiveTab('backups')} style={{ padding: '10px 20px', borderRadius: '4px', border: 'none', backgroundColor: activeTab === 'backups' ? '#f39c12' : '#222', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Backups</button>
                <button onClick={() => setActiveTab('updates')} style={{ padding: '10px 20px', borderRadius: '4px', border: 'none', backgroundColor: activeTab === 'updates' ? '#f39c12' : '#222', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Updates</button>
                <button onClick={() => setActiveTab('mods')} style={{ padding: '10px 20px', borderRadius: '4px', border: 'none', backgroundColor: activeTab === 'mods' ? '#f39c12' : '#222', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Mods</button>
                <button onClick={() => setActiveTab('maintenance')} style={{ padding: '10px 20px', borderRadius: '4px', border: 'none', backgroundColor: activeTab === 'maintenance' ? '#f39c12' : '#222', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Manutenção</button>
            </nav>

            {/* CONTEÚDO DAS ABAS */}
            {activeTab === 'dash' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', alignItems: 'start' }}>
                    <div style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
                        <DashboardSummary />

                        <NetworkStatus />
        <ExternalPortTestCard />


                        <h2 style={{ marginTop: 0, color: '#f39c12', borderBottom: '1px solid #333', paddingBottom: '10px', fontSize: '18px' }}>Configurações do Servidor (.env + ServerSettings.ini)</h2>
                        
                        <div style={{ marginBottom: '12px' }}><label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>Nome do Servidor:</label>
                            <input type="text" value={privacyMode ? '*** oculto ***' : serverName} disabled={privacyMode} onChange={(e) => setServerName(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: privacyMode ? '#1f2937' : '#2a2a2a', color: '#fff' }} />
                        </div>
                        <div style={{ marginBottom: '12px' }}><label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>Senha Admin:</label>
                            <input type="password" value={privacyMode ? '********' : adminPassword} disabled={privacyMode} placeholder={adminPasswordConfigured ? 'Senha já configurada — digite uma nova para trocar' : 'Digite uma senha Admin'} onChange={(e) => setAdminPassword(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: privacyMode ? '#1f2937' : '#2a2a2a', color: '#fff' }} />
                        </div>
                        <div style={{ marginBottom: '12px' }}><label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>Senha RCON:</label>
                            <input type="password" value={privacyMode ? '********' : rconPassword} disabled={privacyMode} placeholder={rconPasswordConfigured ? 'Senha já configurada — digite uma nova para trocar' : 'Digite uma senha RCON'} onChange={(e) => setRconPassword(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: privacyMode ? '#1f2937' : '#2a2a2a', color: '#fff' }} />
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                            <div><label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>Slots:</label>
                                <input type="number" value={maxPlayers} onChange={(e) => setMaxPlayers(parseInt(e.target.value, 10) || 0)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }} />
                            </div>
                            <div><label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>Região:</label>
                                <select value={serverRegion} onChange={(e) => setServerRegion(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}>
                                    <option value="0">Europa</option>
                                    <option value="1">América do Norte</option>
                                    <option value="2">Ásia</option>
                                    <option value="3">Austrália/Oceania</option>
                                    <option value="4">América do Sul</option>
                                    <option value="5">Japão</option>
                                </select>
                            </div>
                            <div><label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>Nudez Máxima do Servidor:</label>
                                <select value={maxNudity} onChange={(e) => { setMaxNudity(e.target.value); setNudityLevel(e.target.value); }} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}>
                                    <option value="0">Desativada</option>
                                    <option value="1">Parcial</option>
                                    <option value="2">Total</option>
                                </select>
                            </div>
                            <div style={{ background: '#2a2112', border: '1px solid #854d0e', borderRadius: '4px', padding: '10px', color: '#facc15', fontSize: '12px' }}>
                                Alterações de região, nudez, mods, slots e senhas podem exigir reinício seguro do Conan para aplicar totalmente.
                            </div>
                        </div>
                        <button onClick={() => salvarConfiguracoes()} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: 'none', backgroundColor: '#e67e22', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Salvar Configurações</button>
                    </div>

                    <div>
                        <div style={{ display: 'none', backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
                            <h2 style={{ marginTop: 0, color: '#f39c12', borderBottom: '1px solid #333', paddingBottom: '10px', fontSize: '18px' }}>Modlist Modificável</h2>
                            <form onSubmit={(e) => { e.preventDefault(); const n = [...mods, novoModId.trim()]; setMods(n); setNovoModId(''); salvarConfiguracoes(n); }} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                <input type="text" placeholder="ID do Mod Steam" value={novoModId} onChange={(e) => setNovoModId(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }} />
                                <button type="submit" style={{ padding: '8px 15px', borderRadius: '4px', border: 'none', backgroundColor: '#2ecc71', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Inserir</button>
                            </form>
                            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                                {mods.map((id) => (
                                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#252525', borderRadius: '4px', marginBottom: '6px', border: '1px solid #333' }}>
                                        <span style={{ fontFamily: 'monospace' }}>🛠️ {id}</span>
                                        <button onClick={() => { const n = mods.filter(m => m !== id); setMods(n); salvarConfiguracoes(n); }} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}>❌</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        
                <div style={{ marginTop: '20px', backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
                            <h2 style={{ marginTop: 0, color: '#f39c12', borderBottom: '1px solid #333', paddingBottom: '10px', fontSize: '18px' }}>Transmissão RCON Direta (Chat Live)</h2>
                            <form onSubmit={enviarRcon} style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <input type="text" placeholder="Digite a mensagem global..." value={textoRcon} onChange={(e) => setTextoRcon(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }} />
                                <button type="submit" style={{ padding: '0 25px', borderRadius: '4px', border: 'none', backgroundColor: '#3498db', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Enviar</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'logs' && (
                <div style={{ backgroundColor: '#151515', padding: '20px', borderRadius: '8px', border: '1px solid #333', fontFamily: 'monospace', minHeight: '450px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                        <span style={{ color: '#2ecc71' }}>💻 stdout@conan-server-console</span>
                        <button onClick={() => { setServerLogs('Atualizando...'); fetch('/api/logs').then(res => res.json()).then(data => setServerLogs(data.logs)); }} style={{ background: '#333', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Atualizar</button>
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', color: '#bbb', margin: 0, fontSize: '13px', maxHeight: '400px', overflowY: 'auto' }}>{serverLogs}</pre>
                </div>
            )}

            {activeTab === 'alerts' && (
                <form onSubmit={salvarAlertas} style={{ backgroundColor: '#1e1e1e', padding: '25px', borderRadius: '8px', border: '1px solid #333', maxWidth: '760px' }}>
                    <h2 style={{ marginTop: 0, color: '#f39c12', borderBottom: '1px solid #333', paddingBottom: '10px', fontSize: '18px' }}>Restart Automático Seguro</h2>

                    <div style={{ padding: '14px', borderRadius: '6px', marginBottom: '18px', background: restartAtivo ? '#12351f' : '#351212', border: restartAtivo ? '1px solid #16a34a' : '1px solid #991b1b' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                            <input
                                type="checkbox"
                                checked={restartAtivo}
                                onChange={(e) => setRestartAtivo(e.target.checked)}
                                style={{ transform: 'scale(1.2)' }}
                            />
                            {restartAtivo ? 'Restart automático seguro ATIVADO' : 'Restart automático seguro DESATIVADO'}
                        </label>
                        <p style={{ margin: '8px 0 0', color: '#ccc', fontSize: '13px' }}>
                            Quando ativado, o cron envia avisos RCON e executa o Reinício Seguro no horário configurado. O Reinício Seguro cria backup antes de reiniciar o Conan.
                        </p>
                    </div>
                    
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ color: '#aaa', display: 'block', marginBottom: '5px' }}>Horário diário do restart seguro:</label>
                        <input type="time" value={horaRestart} onChange={(e) => setHoraRestart(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }} />
                    </div>

                    <div style={{ border: '1px solid #2d2d2d', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#e67e22' }}>Primeiro Alerta RCON</h3>
                        <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
                            <div style={{ width: '140px' }}><label style={{ fontSize: '12px', color: '#888' }}>Minutos antes:</label>
                                <input type="number" min="1" max="120" value={tempoAviso1} onChange={(e) => setTempoAviso1(parseInt(e.target.value, 10) || 10)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }} />
                            </div>
                            <div style={{ flex: 1 }}><label style={{ fontSize: '12px', color: '#888' }}>Mensagem:</label>
                                <input type="text" value={mensagem1} onChange={(e) => setMensagem1(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }} />
                            </div>
                        </div>
                    </div>

                    <div style={{ border: '1px solid #2d2d2d', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#e67e22' }}>Segundo Alerta RCON</h3>
                        <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
                            <div style={{ width: '140px' }}><label style={{ fontSize: '12px', color: '#888' }}>Minutos antes:</label>
                                <input type="number" min="1" max="120" value={tempoAviso2} onChange={(e) => setTempoAviso2(parseInt(e.target.value, 10) || 5)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }} />
                            </div>
                            <div style={{ flex: 1 }}><label style={{ fontSize: '12px', color: '#888' }}>Mensagem:</label>
                                <input type="text" value={mensagem2} onChange={(e) => setMensagem2(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }} />
                            </div>
                        </div>
                    </div>

                    <button type="submit" style={{ padding: '10px 20px', borderRadius: '4px', border: 'none', backgroundColor: restartAtivo ? '#16a34a' : '#e67e22', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                        Salvar Restart Seguro
                    </button>
                </form>
            )}


            {activeTab === 'updates' && <UpdatesManager />}

            {activeTab === 'mods' && <ModsManager />}

            {activeTab === 'maintenance' && <MaintenanceManager />}

            {activeTab === 'backups' && (
                <BackupManager />
            )}

        </div>
    );
}
