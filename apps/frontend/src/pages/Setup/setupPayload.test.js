import { describe, expect, it } from 'vitest'
import { buildProfilePayload } from '../../utils/profilePayload.js'

const base = {
    barberName: ' Lucas ',
    name: 'Barbearia do Zé',
    phone: ' (85) 99999-1234 ',
    slug: ' Barbearia do Zé '
}

describe('payload de criação do perfil', () => {
    it('envia sellsProducts como booleano explícito quando o usuário opta por produtos', () => {
        expect(buildProfilePayload({ ...base, sellsProducts: true })).toEqual({
            barberName: 'Lucas',
            name: 'Barbearia do Zé',
            phone: '(85) 99999-1234',
            slug: 'barbearia-do-ze',
            sellsProducts: true
        })
    })

    it('envia false quando a opção não foi marcada', () => {
        expect(buildProfilePayload({ ...base, sellsProducts: null }).sellsProducts).toBe(false)
        expect(buildProfilePayload({ ...base, sellsProducts: false }).sellsProducts).toBe(false)
    })
})
