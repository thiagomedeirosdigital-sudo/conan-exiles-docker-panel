'use client';

import { useEffect, useState } from 'react';

type BackupItem = {
  filename: string;
  name?: string;
  type?: string;
  size?: string;
  sizeMB?: string;
  date?: string;
  modifiedAt?: string;
};

type BackupsResponse = {
  safeBackups?: BackupItem[];
  legacyBackups?: BackupItem[];
  warning?: string;
};

export default function BackupManager() {
  const [safeBackups, setSafeBackups] = useState<BackupItem[]>([]);
  const [legacyBackups, setLegacyBackups] = useState<BackupItem[]>([]);
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(false);

  const carregarBackups = async () => {
    try {
      const res = await fetch('/api/backups');
      const data: BackupsResponse = await res.json();

      setSafeBackups(Array.isArray(data.safeBackups) ? data.safeBackups : []);
      setLegacyBackups(Array.isArray(data.legacyBackups) ? data.legacyBackups : []);
      setWarning(data.warning || '');
    } catch {
      alert('Erro ao carregar backups.');
    }
  };

  useEffect(() => {
    carregarBackups();
  }, []);

  const criarBackupSeguro = async () => {
    const ok = confirm(
      'Criar backup seguro agora?\n\n' +
      'O Conan será parado temporariamente para copiar banco, WAL/SHM e configurações com segurança.'
    );

    if (!ok) return;

    setLoading(true);

    try {
      const res = await fetch('/api/backups', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        alert(data.message || 'Backup seguro criado com sucesso.');
        await carregarBackups();
      } else {
        alert('Erro: ' + (data.error || data.message || 'Falha ao criar backup seguro.'));
      }
    } catch {
      alert('Erro de comunicação ao criar backup seguro.');
    } finally {
      setLoading(false);
    }
  };

  const excluirBackupsLegacy = async () => {
    const ok = confirm(
      'Excluir todos os backups antigos/inseguros?\n\n' +
      'Isso NÃO apaga os backups seguros da pasta backups_safe.\n\n' +
      'Essa ação não pode ser desfeita.'
    );

    if (!ok) return;

    setLoading(true);

    try {
      const res = await fetch('/api/backups/legacy-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'EXCLUIR_BACKUPS_LEGACY' })
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message || 'Backups antigos removidos.');
        await carregarBackups();
      } else {
        alert('Erro: ' + (data.error || data.message || 'Falha ao excluir backups antigos.'));
      }
    } catch {
      alert('Erro de comunicação ao excluir backups antigos.');
    } finally {
      setLoading(false);
    }
  };


  const restaurarBackupSeguro = async (backupName: string) => {
    const ok = confirm(
      `Restaurar o backup seguro ${backupName}?\n\n` +
      'O Conan será parado, o banco atual será salvo em um backup de emergência e depois o backup escolhido será restaurado.\n\n' +
      'Use somente se tiver certeza.'
    );

    if (!ok) return;

    setLoading(true);

    try {
      const res = await fetch('/api/backups/restore-safe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backupName,
          confirm: 'RESTAURAR_BACKUP_SEGURO',
          restoreConfig: false
        })
      });

      const data = await res.json();

      if (data.success) {
        alert(
          (data.message || 'Backup restaurado com sucesso.') +
          '\n\nBackup de emergência criado em:\n' +
          (data.emergencyBackup || '-')
        );
        await carregarBackups();
      } else {
        alert('Erro: ' + (data.error || 'Falha ao restaurar backup seguro.'));
      }
    } catch {
      alert('Erro de comunicação ao restaurar backup seguro.');
    } finally {
      setLoading(false);
    }
  };

  const excluirBackupSeguro = async (backupName: string) => {
    const ok = confirm(
      `Excluir o backup seguro ${backupName}?\n\n` +
      'Essa ação apaga a pasta inteira desse backup e não pode ser desfeita.'
    );

    if (!ok) return;

    setLoading(true);

    try {
      const res = await fetch('/api/backups/delete-safe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backupName,
          confirm: 'EXCLUIR_BACKUP_SEGURO'
        })
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message || 'Backup seguro excluído.');
        await carregarBackups();
      } else {
        alert('Erro: ' + (data.error || 'Falha ao excluir backup seguro.'));
      }
    } catch {
      alert('Erro de comunicação ao excluir backup seguro.');
    } finally {
      setLoading(false);
    }
  };

  const nomeBackup = (backup: BackupItem) => backup.filename || backup.name || '';

  return (
    <div style={{ backgroundColor: '#1e1e1e', padding: '22px', borderRadius: '10px', color: '#fff', border: '1px solid #333' }}>
      {/* BACKUP_LAYOUT_V2 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, color: '#f39c12' }}>💾 Backups do Servidor</h2>
          <p style={{ marginTop: '6px', color: '#cbd5e1' }}>
            Gerencie apenas backups seguros do Conan. Backups antigos foram removidos da tela para evitar confusão.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={excluirBackupsLegacy}
            disabled={loading}
            style={{
              backgroundColor: '#7f1d1d',
              color: '#fff',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '5px',
              cursor: loading ? 'wait' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            🧹 Excluir backups antigos
          </button>

          <button
            onClick={criarBackupSeguro}
            disabled={loading}
            style={{
              backgroundColor: '#16a34a',
              color: '#fff',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '5px',
              cursor: loading ? 'wait' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            ✅ Criar Backup Seguro
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '6px' }}>
          Processando...
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginTop: '18px' }}>
        <div style={{ background: '#151515', border: '1px solid #166534', borderRadius: '8px', padding: '14px' }}>
          <strong style={{ color: '#86efac', display: 'block', fontSize: '15px' }}>🛡️ Backups seguros</strong>
          <span style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>{safeBackups.length}</span>
          <p style={{ margin: '6px 0 0', color: '#aaa', fontSize: '12px' }}>Indicados para restauração.</p>
        </div>


        <div style={{ background: '#151515', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '14px' }}>
          <strong style={{ color: '#fecaca', display: 'block', fontSize: '15px' }}>⚠️ Atenção</strong>
          <p style={{ margin: '6px 0 0', color: '#ddd', fontSize: '12px' }}>Restaurar backup altera o estado atual do servidor. Use com cuidado.</p>
        </div>
      </div>

      <h3 style={{ marginTop: '24px', color: '#f39c12', borderBottom: '1px solid #333', paddingBottom: '8px' }}>🛡️ Backups seguros disponíveis</h3>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #444' }}>
            <th style={{ textAlign: 'left', padding: '10px' }}>Data / Hora</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Nome do backup</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Tamanho DB</th>
            <th style={{ textAlign: 'right', padding: '10px' }}>Ações seguras</th>
          </tr>
        </thead>
        <tbody>
          {safeBackups.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '18px', textAlign: 'center', color: '#aaa' }}>
                Nenhum backup seguro encontrado. Clique em “Criar Backup Seguro” para gerar o primeiro.
              </td>
            </tr>
          ) : (
            safeBackups.map((backup) => {
              const name = nomeBackup(backup);

              return (
                <tr key={name} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '10px' }}>{backup.date || backup.modifiedAt || '-'}</td>
                  <td style={{ padding: '10px', fontFamily: 'monospace' }}>{name}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ backgroundColor: '#333', padding: '3px 7px', borderRadius: '4px' }}>
                      {backup.size || backup.sizeMB || '-'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <button
                      onClick={() => restaurarBackupSeguro(name)}
                      disabled={loading}
                      style={{
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        padding: '7px 10px',
                        borderRadius: '4px',
                        marginRight: '8px',
                        cursor: loading ? 'wait' : 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      🔁 Restaurar seguro
                    </button>

                    <button
                      onClick={() => excluirBackupSeguro(name)}
                      disabled={loading}
                      style={{
                        backgroundColor: '#7f1d1d',
                        color: '#fff',
                        border: 'none',
                        padding: '7px 10px',
                        borderRadius: '4px',
                        cursor: loading ? 'wait' : 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      Excluir seguro
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>


    </div>
  );
}
