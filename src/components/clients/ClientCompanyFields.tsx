import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

export type ClientFormFields = {
  name: string
  code: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  country: string
  gstin: string
}

export function emptyClientForm(): ClientFormFields {
  return {
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    gstin: '',
  }
}

export function clientFormFromClient(c: {
  name: string
  code?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  gstin?: string | null
}): ClientFormFields {
  return {
    name: c.name,
    code: c.code ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
    city: c.city ?? '',
    state: c.state ?? '',
    country: c.country ?? '',
    gstin: c.gstin ?? '',
  }
}

export function clientFormToPayload(form: ClientFormFields) {
  const t = (v: string) => v.trim() || undefined
  return {
    name: form.name.trim(),
    code: t(form.code),
    email: t(form.email),
    phone: t(form.phone),
    address: t(form.address),
    city: t(form.city),
    state: t(form.state),
    country: t(form.country),
    gstin: t(form.gstin),
  }
}

type Props = {
  value: ClientFormFields
  onChange: (value: ClientFormFields) => void
  nameRequired?: boolean
  compact?: boolean
}

export function ClientCompanyFields({ value, onChange, nameRequired, compact }: Props) {
  const set = (key: keyof ClientFormFields, val: string) => onChange({ ...value, [key]: val })

  return (
    <div className={`grid grid-cols-1 ${compact ? 'gap-3' : 'sm:grid-cols-2 gap-4'}`}>
      <Input
        label="Company name"
        required={nameRequired}
        value={value.name}
        onChange={(e) => set('name', e.target.value)}
        className={compact ? '' : 'sm:col-span-2'}
      />
      <Input
        label="Client code"
        helper="Optional short code"
        value={value.code}
        onChange={(e) => set('code', e.target.value)}
        placeholder="e.g. ACME"
      />
      <Input
        label="GSTIN"
        value={value.gstin}
        onChange={(e) => set('gstin', e.target.value.toUpperCase())}
        placeholder="29AAAAA0000A1Z5"
      />
      <Input
        label="Email"
        type="email"
        value={value.email}
        onChange={(e) => set('email', e.target.value)}
      />
      <Input
        label="Phone"
        type="tel"
        value={value.phone}
        onChange={(e) => set('phone', e.target.value)}
      />
      <div className={compact ? '' : 'sm:col-span-2'}>
        <Textarea
          label="Address"
          rows={compact ? 2 : 3}
          value={value.address}
          onChange={(e) => set('address', e.target.value)}
          placeholder="Street, building, area"
        />
      </div>
      <Input label="City" value={value.city} onChange={(e) => set('city', e.target.value)} />
      <Input label="State" value={value.state} onChange={(e) => set('state', e.target.value)} />
      <Input
        label="Country"
        value={value.country}
        onChange={(e) => set('country', e.target.value)}
        className={compact ? '' : 'sm:col-span-2'}
      />
    </div>
  )
}
