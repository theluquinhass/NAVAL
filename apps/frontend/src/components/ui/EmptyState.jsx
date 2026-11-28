import Icon from './Icon.jsx'

export default function EmptyState({ icon = 'info', title, children, action }) {
    return (
        <div className="ui-empty">
            <span className="ui-empty__icon"><Icon name={icon} /></span>
            <p className="ui-empty__title">{title}</p>
            {children && <p className="ui-empty__text">{children}</p>}
            {action && <div className="ui-empty__action">{action}</div>}
        </div>
    )
}
