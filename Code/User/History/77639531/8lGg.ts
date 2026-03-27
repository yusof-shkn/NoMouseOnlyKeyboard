// src/features/main/CustomerForm/handlers/customerForm.handlers.ts

import { notifications } from '@mantine/notifications'
import { closeModal } from '@shared/components/genericModal'
import { CustomerFormValues } from '../types/customerForm.types'
import { Customer } from '@shared/types/customer'
import { createCustomer, updateCustomer } from '../data/customers.queries'
import { validateCustomerData } from '../utils/customerForm.utils'
import { Profile } from '@shared/types/profile'

export const handleSubmit = async (
  values: CustomerFormValues,
  mode: 'create' | 'edit',
  initialValues: Customer | undefined,
  dispatch: any,
  setLoading: (loading: boolean) => void,
  currentUser: Profile | null,
) => {
  try {
    setLoading(true)

    const validation = validateCustomerData({
      first_name: values.first_name,
      last_name: values.last_name,
      phone: values.phone,
      email: values.email,
      company_id: parseInt(values.company_id),
      credit_limit: values.credit_limit,
    })

    if (!validation.valid) {
      notifications.show({
        title: 'Validation Error',
        message: validation.errors.join(', '),
        color: 'red',
      })
      setLoading(false)
      return
    }

    const creditLimit = values.credit_limit || 0

    // Calculate available_credit BEFORE building fullCustomerData
    // so it is included in the insert/update payload
    let availableCredit = 0
    if (creditLimit > 0) {
      if (mode === 'create') {
        availableCredit = creditLimit
      } else if (mode === 'edit' && initialValues) {
        const currentBalance = initialValues.current_credit_balance || 0
        availableCredit = Math.max(0, creditLimit - currentBalance)
      }
    }

    const customerData: Partial<Customer> = {
      company_id: parseInt(values.company_id),
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      phone: values.phone.trim(),
      email: values.email?.trim() || null,
      address: values.address?.trim() || null,
      credit_limit: creditLimit,
      credit_days: values.credit_days || 30,
      available_credit: availableCredit,
      // On create, always start balance at 0
      ...(mode === 'create' && { current_credit_balance: 0 }),
      notes: values.notes?.trim() || null,
      is_active: values.is_active,
    }

    // Insurance fields — handled separately inside createCustomer/updateCustomer
    const insuranceData: any = {
      insurance_provider: values.insurance_provider?.trim() || null,
      insurance_number: values.insurance_number?.trim() || null,
      insurance_expiry_date: values.insurance_expiry_date || null,
      insurance_policy_type: values.insurance_policy_type?.trim() || null,
      insurance_coverage_limit: values.insurance_coverage_limit || null,
    }

    const fullCustomerData = { ...customerData, ...insuranceData }

    let result

    if (mode === 'edit' && initialValues?.id) {
      result = await updateCustomer(initialValues.id, fullCustomerData)
      if (result.error) throw new Error(result.error)
      notifications.show({
        title: 'Success',
        message: `Customer "${values.first_name} ${values.last_name}" updated successfully`,
        color: 'green',
      })
    } else {
      result = await createCustomer(fullCustomerData)
      if (result.error) throw new Error(result.error)
      notifications.show({
        title: 'Success',
        message: `Customer "${values.first_name} ${values.last_name}" created successfully`,
        color: 'green',
      })
    }

    window.dispatchEvent(new Event('customerUpdated'))
    dispatch(closeModal())
    setLoading(false)
  } catch (error: any) {
    console.error('Error saving customer:', error)

    let errorMessage = 'Failed to save customer'
    if (error.message?.includes('duplicate key')) {
      if (error.message.includes('phone')) {
        errorMessage = 'A customer with this phone number already exists'
      } else if (error.message.includes('email')) {
        errorMessage = 'A customer with this email already exists'
      } else {
        errorMessage = 'A customer with these details already exists'
      }
    }

    notifications.show({
      title: 'Error',
      message: errorMessage,
      color: 'red',
      autoClose: 7000,
    })
    setLoading(false)
  }
}

export const handleReset = (
  form: any,
  mode: 'create' | 'edit',
  initialValues?: Customer,
) => {
  if (mode === 'edit' && initialValues) {
    form.setValues({
      company_id: String(initialValues.company_id),
      first_name: initialValues.first_name ?? '',
      last_name: initialValues.last_name ?? '',
      phone: initialValues.phone ?? '',
      email: initialValues.email ?? '',
      address: initialValues.address ?? '',
      insurance_provider:
        (initialValues as any).customer_insurance?.insurance_provider ?? '',
      insurance_number:
        (initialValues as any).customer_insurance?.insurance_number ?? '',
      insurance_expiry_date:
        (initialValues as any).customer_insurance?.insurance_expiry_date ?? '',
      insurance_policy_type:
        (initialValues as any).customer_insurance?.policy_type ?? '',
      insurance_coverage_limit:
        (initialValues as any).customer_insurance?.coverage_limit ?? 0,
      credit_limit: initialValues.credit_limit ?? 0,
      credit_days: initialValues.credit_days ?? 30,
      notes: initialValues.notes ?? '',
      is_active: initialValues.is_active ?? true,
    })
  } else {
    form.reset()
  }
}

