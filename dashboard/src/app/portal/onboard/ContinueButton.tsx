interface Props {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    visible?: boolean; // when false: opacity 0 but still occupies space
}

export default function ContinueButton({ label, onClick, disabled = false, visible = true }: Props) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                width: '100%',
                marginTop: 16,
                background: disabled ? 'rgba(218,122,78,0.40)' : '#da7a4e',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '16px 24px',
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'var(--sans-portal)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: visible ? 1 : 0,
                transition: 'opacity 0.2s ease',
                pointerEvents: visible ? 'auto' : 'none',
            }}
        >
            {label}
        </button>
    );
}
