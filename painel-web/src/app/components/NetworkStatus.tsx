'use client';

import { useEffect, useState } from 'react';

export default function NetworkStatus() {
  const [network, setNetwork] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function carregarNetwork() {
    setLoading(true);

    try {
      const res = await fetch('/api/network');
      const data = await res.json();
      setNetwork(data);
    } catch {
      setNetwork(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarNetwork();
    const interval = setInterval(carregarNetwork, 30000);
    return () => clearInterval(interval);
  }, []);

  const cardStyle: React.CSSProperties = {
    background: '#1f1f1f',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '16px'
  };

  const labelStyle: React.CSSProperties = {
    color: '#cbd5e1',
    fontSize: '13px',
    textTransform: 'uppercase',
    marginBottom: '8px'
  };

  return (
    <div style={{
      background: '#1b1b1b',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '20px',
      marginTop: '24px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h2 style={{
          margin: 0,
          color: '#f39c12',
          fontSize: '20px'
        }}>
          🌐 Status de Rede / Portas
        </h2>

        <button
          onClick={carregarNetwork}
          disabled={loading}
          style={{
            background: '#3498db',
            color: '#fff',
            border: 0,
            borderRadius: '6px',
            padding: '10px 14px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Atualizando...' : '🔄 Atualizar rede'}
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px'
      }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Status local</div>
          <div style={{
            color: network?.localOk ? '#22c55e' : '#ef4444',
            fontSize: '26px',
            fontWeight: 'bold'
          }}>
            {network?.localOk ? 'OK' : 'Atenção'}
          </div>
          <div style={{ color: '#cbd5e1', fontSize: '14px' }}>
            Docker + portas + Steam Query
          </div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>IP público</div>
          <div style={{
            color: '#fff',
            fontSize: '22px',
            fontWeight: 'bold'
          }}>
            {network?.publicIp || 'Não detectado'}
          </div>
          <div style={{ color: '#cbd5e1', fontSize: '14px' }}>
            Compare com o IP WAN do roteador
          </div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Portas locais</div>
          <div style={{ color: '#fff', fontSize: '14px', lineHeight: '1.8' }}>
            <div>{network?.checks?.udp7777Mapped ? '✅' : '❌'} 7777 UDP</div>
            <div>{network?.checks?.udp7778Mapped ? '✅' : '❌'} 7778 UDP</div>
            <div>{network?.checks?.udp27015Mapped ? '✅' : '❌'} 27015 UDP</div>
            <div>{network?.checks?.tcp25575Mapped ? '✅' : '❌'} 25575 TCP</div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Steam Query</div>
          <div style={{
            color: network?.checks?.steamQueryLocalOk ? '#22c55e' : '#ef4444',
            fontSize: '22px',
            fontWeight: 'bold'
          }}>
            {network?.checks?.steamQueryLocalOk ? 'Respondendo' : 'Sem resposta'}
          </div>
          <div style={{ color: '#cbd5e1', fontSize: '14px' }}>
            {network?.checks?.serverName || 'Servidor não detectado'}
          </div>
        </div>
      </div>

      <div style={{
        marginTop: '16px',
        background: '#332a12',
        border: '1px solid #f59e0b',
        color: '#fde68a',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '14px'
      }}>
        ⚠️ O teste local confirma que Docker, portas e Steam Query estão corretos dentro do servidor.
        Para confirmar bloqueio externo da operadora, compare o IP público com o IP WAN do roteador ou teste pelo 4G/5G.
      </div>
    </div>
  );
}
