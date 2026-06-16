'use client';

export type ConfirmDialogData = {
  titulo: string;
  mensagem: string;
  confirmarTexto: string;
  tipo?: 'perigo' | 'aviso';
};

type ConfirmModalProps = {
  dialog: ConfirmDialogData | null;
  onCancel: () => void;
  onConfirm: () => void;
  aviso?: string;
};

export default function ConfirmModal({
  dialog,
  onCancel,
  onConfirm,
  aviso = 'Essa é uma ação crítica. Confirme apenas se tiver certeza.'
}: ConfirmModalProps) {
  if (!dialog) return null;

  const isPerigo = dialog.tipo === 'perigo';

  return (
    <div
      /* CONFIRM_MODAL_COMPONENT_V1 */
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
        maxWidth: '480px',
        backgroundColor: '#1e1e1e',
        border: isPerigo ? '1px solid #dc2626' : '1px solid #f39c12',
        borderRadius: '12px',
        padding: '22px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.45)'
      }}>
        <h2 style={{
          marginTop: 0,
          marginBottom: '10px',
          color: isPerigo ? '#f87171' : '#f39c12',
          fontSize: '20px'
        }}>
          ⚠️ {dialog.titulo}
        </h2>

        <p style={{
          color: '#ddd',
          fontSize: '14px',
          lineHeight: 1.5,
          marginBottom: '18px'
        }}>
          {dialog.mensagem}
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
          {aviso}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <button
            type="button"
            onClick={onCancel}
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
            onClick={onConfirm}
            style={{
              padding: '10px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isPerigo ? '#dc2626' : '#f39c12',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {dialog.confirmarTexto}
          </button>
        </div>
      </div>
    </div>
  );
}
