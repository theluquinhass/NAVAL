create or replace function public.get_public_busy_times(
    p_slug text,
    p_date text
)
returns table (
    starts_at timestamptz,
    ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
    v_date date;
    v_today date := (
        statement_timestamp() at time zone 'America/Fortaleza'
    )::date;
    v_profile_id uuid;
    v_from timestamptz;
    v_to timestamptz;
begin
    if p_slug is null or btrim(p_slug) = '' then
        raise exception 'Slug da barbearia obrigatório.'
            using errcode = '22023';
    end if;

    if p_date is null or p_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception 'Data deve usar o formato YYYY-MM-DD.'
            using errcode = '22007';
    end if;

    begin
        v_date := p_date::date;
    exception
        when invalid_datetime_format
          or datetime_field_overflow
          or invalid_text_representation then
            raise exception 'Data inválida.'
                using errcode = '22007';
    end;

    if to_char(v_date, 'YYYY-MM-DD') <> p_date then
        raise exception 'Data inválida.'
            using errcode = '22007';
    end if;

    if v_date < v_today then
        raise exception 'A data não pode ser anterior ao dia atual.'
            using errcode = '22023';
    end if;

    if v_date > v_today + 90 then
        raise exception 'A data não pode ultrapassar 90 dias de antecedência.'
            using errcode = '22023';
    end if;

    begin
        select b.id
          into strict v_profile_id
          from public.barbershops as b
         where b.slug = p_slug;
    exception
        when no_data_found then
            raise exception 'Barbearia não encontrada.'
                using errcode = 'P0002';
        when too_many_rows then
            raise exception 'Slug da barbearia não é único.'
                using errcode = '21000';
    end;

    v_from := v_date::timestamp
        at time zone 'America/Fortaleza';
    v_to := (v_date + 1)::timestamp
        at time zone 'America/Fortaleza';

    return query
    select a.starts_at, a.ends_at
      from public.appointments as a
     where a.profile_id = v_profile_id
       and a.status = 'confirmed'
       and a.starts_at < v_to
       and a.ends_at > v_from;
end;
$function$;

revoke all
    on function public.get_public_busy_times(text, text)
    from public;

grant execute
    on function public.get_public_busy_times(text, text)
    to anon, authenticated;
