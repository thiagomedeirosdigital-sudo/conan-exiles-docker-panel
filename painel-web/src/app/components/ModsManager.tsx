'use client';

import { useEffect, useRef, useState } from 'react';

type ModInfo = {
  modId: string;
  order: number;
  title: string;
  updatedAt?: string;
  time_updated?: number;
  modlistLine?: string;
  hasModlistLine?: boolean;
};

export default function ModsManager() {
  const [mods, setMods] = useState<ModInfo[]>([]);
  const [novoMod, setNovoMod] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro' | 'aviso'; texto: string } | null>(null);

  const confirmResolver = useRef<((value: boolean) => void) | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    titulo: string;
    mensagem: string;
    confirmarTexto: string;
    tipo?: 'perigo' | 'aviso';
  } | null>(null);

  const pedirConfirmacao = (
    titulo: string,
    mensagem: string,
    confirmarTexto: string,
    tipo: 'perigo' | 'aviso' = 'aviso'
  ) => {
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
      setConfirmDialog({ titulo, mensagem, confirmarTexto, tipo });
    });
  };

  const fecharConfirmacao = (confirmado: boolean) => {
    if (confirmResolver.current) {
      confirmResolver.current(confirmado);
      confirmResolver.current = null;
    }
    setConfirmDialog(null);
  };

  const carregar = async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/mods');
      const data = await res.json();

      if (data.success && Array.isArray(data.mods)) {
        setMods(data.mods);
      } else {
        setFeedback({ tipo: 'erro', texto: data.error || 'Erro ao carregar mods.' });
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro de comunicação ao carregar mods.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const mover = (index: number, direction: 'up' | 'down') => {
    setMods(prev => {
      const arr = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;

      if (target < 0 || target >= arr.length) return prev;

      const temp = arr[index];
      arr[index] = arr[target];
      arr[target] = temp;

      return arr.map((m, i) => ({ ...m, order: i + 1 }));
    });
  };

  const salvar = async (lista = mods) => {
    const modIds = lista.map(m => String(m.modId)).filter(Boolean);

    if (!modIds.length) {
      setFeedback({ tipo: 'erro', texto: 'Nenhum mod para salvar.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/mods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-order', modIds })
      });

      const data = await res.json();

      if (data.success) {
        setMods(data.mods || lista);
        setFeedback({ tipo: 'sucesso', texto: data.message || 'Ordem dos mods salva. Use Reinício Seguro para aplicar.' });
      } else {
        setFeedback({ tipo: 'erro', texto: data.error || 'Erro ao salvar mods.' });
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro de comunicação ao salvar mods.' });
    } finally {
      setLoading(false);
    }
  };

  const adicionar = async () => {
    const id = novoMod.trim();

    if (!/^\d+$/.test(id)) {
      setFeedback({ tipo: 'erro', texto: 'Informe um ID Steam válido do mod.' });
      return;
    }

    if (mods.some(m => m.modId === id)) {
      setFeedback({ tipo: 'erro', texto: 'Esse mod já está na lista.' });
      return;
    }

    const novaLista = [
      ...mods,
      {
        modId: id,
        order: mods.length + 1,
        title: id,
        updatedAt: '',
        hasModlistLine: false
      }
    ];

    setMods(novaLista);
    setNovoMod('');
    await salvar(novaLista);
    setTimeout(carregar, 700);
  };

  const remover = async (id: string) => {
    const confirmado = await pedirConfirmacao(
      'Remover mod da lista?',
      `O mod ${id} será removido da lista e a nova ordem será salva no .env e no modlist.txt. Use Reinício Seguro para aplicar no servidor.`,
      'Remover mod',
      'perigo'
    );

    if (!confirmado) return;

    const novaLista = mods.filter(m => m.modId !== id).map((m, i) => ({ ...m, order: i + 1 }));
    setMods(novaLista);
    await salvar(novaLista);
  };

  return (
    <div style={{ backgroundColor: '#1e1e1e', padding: '25px', borderRadius: '10px', border: '1px solid #333', maxWidth: '1200px' }}>
      {/* MODS_LAYOUT_V2 */}
      <h2 style={{ marginTop: 0, color: '#f39c12', borderBottom: '1px solid #333', paddingBottom: '10px', fontSize: '22px' }}>
        🧩 Mods e Ordem de Carregamento
      </h2>
      <p style={{ marginTop: '-2px', marginBottom: '18px', color: '#aaa', fontSize: '14px' }}>
        Gerencie a lista de mods, ajuste a ordem real de carregamento e aplique alterações com segurança.
      </p>

      {feedback && (
        <div style={{
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '15px',
          backgroundColor: feedback.tipo === 'sucesso' ? '#14532d' : feedback.tipo === 'aviso' ? '#2a2412' : '#5a1a1a',
          border: feedback.tipo === 'aviso' ? '1px solid #8a5a00' : '1px solid transparent',
          color: feedback.tipo === 'aviso' ? '#facc15' : '#fff'
        }}>
          {feedback.texto}
        </div>
      )}

      <div style={{ padding: '14px', borderRadius: '8px', marginBottom: '16px', background: '#2a2412', border: '1px solid #8a5a00', color: '#f1c40f' }}>
        <b>⚠️ Importante:</b><br />
        A ordem abaixo é a ordem real de carregamento do Conan. Após alterar, use “Salvar e Aplicar Mods com Segurança” para criar backup, aplicar mods e reiniciar corretamente.
      </div>

      <div style={{ background: '#151515', border: '1px solid #333', borderRadius: '8px', padding: '14px', marginBottom: '18px' }}>
        <h3 style={{ marginTop: 0, color: '#f39c12', fontSize: '16px' }}>➕ Adicionar ou atualizar lista</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="ID do Mod Steam"
          value={novoMod}
          onChange={(e) => setNovoMod(e.target.value)}
          style={{ flex: 1, minWidth: '220px', padding: '9px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
        />

        <button type="button" onClick={adicionar} disabled={loading} style={{ padding: '9px 14px', borderRadius: '4px', border: 'none', backgroundColor: '#2ecc71', color: '#fff', fontWeight: 'bold', cursor: loading ? 'wait' : 'pointer' }}>
          ➕ Inserir mod
        </button>

        <button type="button" onClick={carregar} disabled={loading} style={{ padding: '9px 14px', borderRadius: '4px', border: 'none', backgroundColor: '#3498db', color: '#fff', fontWeight: 'bold', cursor: loading ? 'wait' : 'pointer' }}>
          🔄 Recarregar nomes da Steam
        </button>

          <button
            type="button"
            onClick={async () => {
              const ok = await pedirConfirmacao(
                'Aplicar mods com segurança?',
                'Isso vai salvar a ordem atual, criar backup seguro, parar o Conan, recriar o container, baixar mods novos e subir o servidor novamente. Use somente em horário seguro.',
                'Aplicar mods com segurança',
                'perigo'
              );

              if (!ok) return;

              setFeedback({ tipo: 'aviso', texto: 'Aplicação segura de mods iniciada. Aguarde o processo...' });

              try {
                await salvar();

                const res = await fetch('/api/mods/apply', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ confirm: 'APLICAR_MODS' })
                });

                const data = await res.json();

                if (!data.success) {
                  setFeedback({ tipo: 'erro', texto: data.error || 'Falha ao aplicar mods.' });
                  return;
                }

                setFeedback({ tipo: 'sucesso', texto: 'Mods aplicados com segurança. Aguarde o servidor terminar de subir e confira os logs.' });
                await carregar();
              } catch {
                setFeedback({ tipo: 'erro', texto: 'Erro ao aplicar mods com segurança.' });
              }
            }}
            style={{
              padding: '10px 16px',
              borderRadius: '5px',
              border: 'none',
              backgroundColor: '#dc2626',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🚀 Salvar e Aplicar Mods com Segurança
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '10px', background: '#222', border: '1px solid #444', borderRadius: '6px', marginBottom: '10px', color: '#ddd' }}>
          Carregando mods...
        </div>
      )}

      <div style={{ background: '#151515', border: '1px solid #333', borderRadius: '8px', padding: '14px' }}>
        <h3 style={{ marginTop: 0, color: '#f39c12', fontSize: '16px' }}>📋 Ordem de carregamento dos mods</h3>
        <p style={{ color: '#aaa', fontSize: '13px', marginTop: '-4px' }}>
          Use as setas para reorganizar. O primeiro item carrega primeiro.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {mods.map((mod, index) => (
          <div key={mod.modId} style={{ display: 'grid', gridTemplateColumns: '55px 1fr 120px 100px', gap: '12px', alignItems: 'center', padding: '12px', backgroundColor: '#252525', border: '1px solid #333', borderRadius: '6px' }}>
            <div style={{ color: '#f39c12', fontWeight: 'bold' }}>#{index + 1}</div>

            <div>
              <div style={{ color: '#fff', fontWeight: 'bold' }}>🛠️ {mod.title || mod.modId}</div>
              <div style={{ color: '#aaa', fontSize: '12px' }}>ID Steam: {mod.modId}</div>
              {mod.updatedAt && <div style={{ color: '#888', fontSize: '11px' }}>Steam atualizado em: {mod.updatedAt}</div>}
              {mod.hasModlistLine === false && <div style={{ color: '#e67e22', fontSize: '11px' }}>Atenção: linha não encontrada no modlist atual.</div>}
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={() => mover(index, 'up')} disabled={index === 0 || loading} style={{ padding: '7px 10px', borderRadius: '4px', border: 'none', backgroundColor: index === 0 ? '#555' : '#444', color: '#fff', cursor: index === 0 ? 'not-allowed' : 'pointer' }}>↑</button>
              <button type="button" onClick={() => mover(index, 'down')} disabled={index === mods.length - 1 || loading} style={{ padding: '7px 10px', borderRadius: '4px', border: 'none', backgroundColor: index === mods.length - 1 ? '#555' : '#444', color: '#fff', cursor: index === mods.length - 1 ? 'not-allowed' : 'pointer' }}>↓</button>
            </div>

            <button type="button" onClick={() => remover(mod.modId)} disabled={loading} style={{ padding: '7px 9px', borderRadius: '4px', border: 'none', backgroundColor: '#5a1a1a', color: '#ff6b6b', fontWeight: 'bold', cursor: loading ? 'wait' : 'pointer' }}>
              Remover
            </button>
          </div>
        ))}

        {mods.length === 0 && !loading && (
          <div style={{ padding: '14px', background: '#1e1e1e', border: '1px solid #333', borderRadius: '6px', color: '#aaa' }}>
            Nenhum mod carregado.
          </div>
        )}
        </div>
      </div>

      {confirmDialog && (
        <div
          /* MODS_CONFIRM_MODAL_V1 */
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.72)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: '470px',
            backgroundColor: '#1e1e1e',
            border: confirmDialog.tipo === 'perigo' ? '1px solid #dc2626' : '1px solid #f39c12',
            borderRadius: '12px',
            padding: '22px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.45)'
          }}>
            <h2 style={{
              marginTop: 0,
              marginBottom: '10px',
              color: confirmDialog.tipo === 'perigo' ? '#f87171' : '#f39c12',
              fontSize: '20px'
            }}>
              ⚠️ {confirmDialog.titulo}
            </h2>

            <p style={{ color: '#ddd', fontSize: '14px', lineHeight: 1.5, marginBottom: '18px' }}>
              {confirmDialog.mensagem}
            </p>

            <div style={{
              backgroundColor: '#2a2412',
              border: '1px solid #8a5a00',
              color: '#facc15',
              borderRadius: '8px',
              padding: '10px',
              fontSize: '13px',
              marginBottom: '18px'
            }}>
              Essa ação altera a lista de mods. Confirme apenas se tiver certeza.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => fecharConfirmacao(false)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: '1px solid #444',
                  backgroundColor: '#2a2a2a',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => fecharConfirmacao(true)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: confirmDialog.tipo === 'perigo' ? '#dc2626' : '#f39c12',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {confirmDialog.confirmarTexto}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
