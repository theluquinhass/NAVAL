// Demonstration content for the dashboard until the API exposes these summaries.
export const dashboardMetrics = [
    { key: 'today', label: 'Agendamentos de hoje', value: '08', detail: 'Na agenda de hoje', icon: 'calendar' },
    { key: 'completed', label: 'Concluídos', value: '05', detail: 'Atendimentos finalizados', icon: 'check' },
    { key: 'pending', label: 'Pendentes', value: '02', detail: 'Aguardando atendimento', icon: 'clock' },
    { key: 'canceled', label: 'Cancelamentos', value: '01', detail: 'Neste dia', icon: 'close' }
]

export const demoAppointments = [
    { id: 'demo-1', time: '10:00', customer: 'Marcos Oliveira', service: 'Corte tradicional', status: 'Confirmado' },
    { id: 'demo-2', time: '11:30', customer: 'Rafael Santos', service: 'Corte + barba', status: 'Confirmado' },
    { id: 'demo-3', time: '14:00', customer: 'Lucas Mendes', service: 'Barba', status: 'Pendente' }
]

export const demoDayProgress = { total: 8, completed: 5, remaining: 3 }
