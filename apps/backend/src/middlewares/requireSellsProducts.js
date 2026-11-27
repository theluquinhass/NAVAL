import { createUserClient } from '../config/supabase.js'

export async function requireSellsProducts(req, res, next) {
    try {
        const { data, error } = await createUserClient(req.accessToken)
            .from('barbershops')
            .select('sells_products')
            .eq('user_id', req.user.id)
            .maybeSingle()

        if (error) {
            console.error('[products] sells_products lookup failed', error.code ?? '', error.message ?? '')
            return res.status(500).json({
                error: 'Não foi possível verificar as permissões da barbearia.',
                code: 'SELLS_PRODUCTS_CHECK_FAILED'
            })
        }

        if (!data || data.sells_products !== true) {
            return res.status(403).json({
                error: 'Esta barbearia não possui vendas de produtos habilitadas.',
                code: 'SELLS_PRODUCTS_REQUIRED'
            })
        }

        return next()
    } catch (error) {
        console.error('[products] sells_products check error', error?.code ?? '', error?.message ?? '')
        return res.status(500).json({
            error: 'Não foi possível verificar as permissões da barbearia.',
            code: 'SELLS_PRODUCTS_CHECK_FAILED'
        })
    }
}

export default requireSellsProducts
