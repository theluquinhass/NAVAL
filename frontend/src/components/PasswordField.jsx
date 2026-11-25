import { useState } from 'react'

export default function PasswordField({
    id,
    label,
    value,
    onChange,
    autoComplete = 'current-password',
    minLength,
    required = false,
    placeholder = 'Senha'
}) {
    const [visible, setVisible] = useState(false)

    return (
        <div className="auth-field">
            <label htmlFor={id}>{label}</label>
            <div className="auth-field__password">
                <input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={onChange}
                    autoComplete={autoComplete}
                    minLength={minLength}
                    required={required}
                    placeholder={placeholder}
                />
                <button
                    className="auth-field__toggle"
                    type="button"
                    aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={visible}
                    onClick={() => setVisible((current) => !current)}
                >
                    {visible ? 'Ocultar' : 'Mostrar'}
                </button>
            </div>
        </div>
    )
}
