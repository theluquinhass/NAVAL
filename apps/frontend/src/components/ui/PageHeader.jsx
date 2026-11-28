export default function PageHeader({ eyebrow, title, description, actions, titleId }) {
    return (
        <header className="ui-page-header">
            <div className="ui-page-header__text">
                {eyebrow && <p className="ui-page-header__eyebrow">{eyebrow}</p>}
                <h1 id={titleId}>{title}</h1>
                {description && <p className="ui-page-header__description">{description}</p>}
            </div>
            {actions && <div className="ui-page-header__actions">{actions}</div>}
        </header>
    )
}
