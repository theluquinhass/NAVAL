

export default function Feedback({ value }) {
    if (!value) return null
    return (
        <p className={`settings__feedback${value.type === 'error' ? ' settings__feedback--error' : ''}`} role={value.type === 'error' ? 'alert' : 'status'}>
            {value.text}
        </p>
    )
}
