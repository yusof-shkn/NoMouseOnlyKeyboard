// src/features/main/CustomersManagement/modals/PayCustomerCreditModal.tsx
// ✅ FIXED:
//   1. Inserts cash_flow_transactions → visible in v_cash_flow as inflow
//   2. Creates journal entry → visible in v_balance_sheet + v_trial_balance
//      DR Accounts Receivable 1200 (reduces asset — customer owes less)
//      CR Cash/Bank (increases asset — cash comes in)
//   3. Updates all customer fields: current_credit_balance, available_credit,
//      credit_status, total_credit_used
//   4. credit_transactions row includes payment_method, paid_date, notes
//   NOTE: No DB trigger auto-creates journal for customer payments,
//         so we do it manually here (unlike supplier payments).

import { useState } from 'react'
import {
  Stack,
  TextInput,
  NumberInput,
  Textarea,
  Group,
  Button,
  Text,
  Badge,
  Box,
  Alert,
  Paper,
  Select,
  Progress,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCash,
  IconCurrencyDollar,
  IconFileText,
  IconInfoCircle,
  IconCheck,
  IconUser,
  IconCreditCard,
  IconChartBar,
} from '@tabler/icons-react'
import { CustomerWithRelations } from '@shared/types/customer'
import { supabase } from '@app/core/supabase/Supabase.utils'
import { getCurrentUserProfile } from '@shared/utils/authUtils'

interface PayCustomerCreditModalProps {
  customer: CustomerWithRelations
  onClose: () => void
}

interface PaymentFormValues {
  amount: number
  payment_method: string
  reference_number: string
  notes: string
}

// Map payment method → chart of accounts code
const PAYMENT_METHOD_TO_ACCOUNT_CODE: Record<string, string> = {
  cash: '1100', // Cash on Hand
  bank_transfer: '1120', // Bank Account
  mobile_money: '1130', // Mobile Money
  card: '1120', // Card → Bank
  cheque: '1120', // Cheque → Bank
  other: '1100', // Default to cash
}

const PayCustomerCreditModal = ({
  customer,
  onClose,
}: PayCustomerCreditModalProps) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const paperBg = isDark ? theme.colors.dark[6] : theme.white
  const sectionBorderColor = theme.colors[theme.primaryColor][5]
  const dangerBorderColor = theme.colors.red[5]
  const successBorderColor = theme.colors.green[5]

  const [loading, setLoading] = useState(false)

  // Parse all amounts safely — Supabase returns numerics as strings
  const outstandingBalance = parseFloat(
    String(customer.current_credit_balance || 0),
  )
  const creditLimit = parseFloat(String(customer.credit_limit || 0))
  const availableCredit = parseFloat(String(customer.available_credit || 0))
  const totalCreditUsed = parseFloat(
    String((customer as any).total_credit_used || 0),
  )
  const utilization =
    creditLimit > 0 ? (outstandingBalance / creditLimit) * 100 : 0

  const utilizationColor =
    utilization >= 90
      ? 'red'
      : utilization >= 75
        ? 'orange'
        : utilization >= 50
          ? 'yellow'
          : 'green'

  const form = useForm<PaymentFormValues>({
    initialValues: {
      amount: 0,
      payment_method: 'cash',
      reference_number: '',
      notes: '',
    },
    validate: {
      amount: (value) => {
        if (!value || value <= 0) return 'Amount must be greater than 0'
        if (value > outstandingBalance + 0.01)
          return `Amount cannot exceed outstanding balance of ${outstandingBalance.toLocaleString()}`
        return null
      },
      payment_method: (value) =>
        !value?.trim() ? 'Payment method is required' : null,
    },
  })

  const handleSubmit = async (values: PaymentFormValues) => {
    try {
      setLoading(true)

      const user = await getCurrentUserProfile()
      if (!user) throw new Error('User not authenticated')

      const amountPaid = parseFloat(String(values.amount))
      const newBalance = Math.max(0, outstandingBalance - amountPaid)
      const newAvailable = creditLimit - newBalance
      const newTotalUsed = Math.max(0, totalCreditUsed - amountPaid)
      const fullyPaid = newBalance < 0.01

      // Determine new credit_status
      const newCreditStatus = fullyPaid
        ? 'good'
        : newBalance >= creditLimit * 0.9
          ? 'overlimit'
          : newBalance >= creditLimit * 0.75
            ? 'warning'
            : 'good'

      // ─── Step 1: Resolve account IDs from chart_of_accounts ─────────────
      // DR Accounts Receivable 1200 (reduces asset — customer owes less)
      // CR Cash/Bank based on payment method (increases asset — cash in)
      const cashAccountCode =
        PAYMENT_METHOD_TO_ACCOUNT_CODE[values.payment_method] ?? '1100'

      const { data: accounts, error: accountsError } = await supabase
        .from('chart_of_accounts')
        .select('id, account_code, account_name')
        .eq('company_id', customer.company_id)
        .in('account_code', ['1200', cashAccountCode])
        .eq('is_active', true)
        .is('deleted_at', null)

      if (accountsError) throw accountsError

      // Fallback to company_id=1 template if company doesn't have own COA
      let arAccount = accounts?.find((a) => a.account_code === '1200')
      let cashAccount = accounts?.find(
        (a) => a.account_code === cashAccountCode,
      )

      if (!arAccount || !cashAccount) {
        const { data: templateAccounts } = await supabase
          .from('chart_of_accounts')
          .select('id, account_code, account_name')
          .eq('company_id', 1)
          .in('account_code', ['1200', cashAccountCode])
          .eq('is_active', true)
          .is('deleted_at', null)

        if (!arAccount)
          arAccount =
            templateAccounts?.find((a) => a.account_code === '1200') ?? null
        if (!cashAccount)
          cashAccount =
            templateAccounts?.find((a) => a.account_code === cashAccountCode) ??
            null
      }

      // ─── Step 2: Create journal entry ────────────────────────────────────
      // Drives v_trial_balance and v_balance_sheet
      let journalEntryId: number | null = null

      if (arAccount && cashAccount) {
        // ✅ FIX: Generate entry_number matching existing pattern
        // Pattern: JE-PAY-PAY-{ref}-{timestamp}-{random}
        // e.g.   JE-PAY-PAY-CUST29-1772071631237-043
        const timestamp = Date.now()
        const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
        const entryNumber = `JE-PAY-PAY-CUST${customer.id}-${timestamp}-${random}`

        const { data: journalEntry, error: journalError } = await supabase
          .from('journal_entries')
          .insert({
            company_id: customer.company_id,
            entry_number: entryNumber, // ✅ FIXED: was missing, caused NOT NULL violation
            entry_date: new Date().toISOString().split('T')[0],
            entry_type: 'payment',
            reference_type: 'credit_payment',
            reference_id: customer.id,
            description: `Customer credit payment - ${customer.first_name} ${customer.last_name}`,
            is_posted: true,
            status: 'posted',
            posted_at: new Date().toISOString(),
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (journalError)
          throw new Error(`Journal entry failed: ${journalError.message}`)
        journalEntryId = journalEntry.id

        const { error: linesError } = await supabase
          .from('journal_entry_lines')
          .insert([
            {
              // DR Cash/Bank — asset increases (cash comes in)
              journal_entry_id: journalEntryId,
              company_id: customer.company_id,
              account_id: cashAccount.id,
              debit_amount: amountPaid,
              credit_amount: 0,
              line_description: `${values.payment_method} payment from ${customer.first_name} ${customer.last_name}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              // CR Accounts Receivable 1200 — asset decreases (customer owes less)
              journal_entry_id: journalEntryId,
              company_id: customer.company_id,
              account_id: arAccount.id,
              debit_amount: 0,
              credit_amount: amountPaid,
              line_description: `Credit payment - ${customer.first_name} ${customer.last_name}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])

        if (linesError) {
          await supabase
            .from('journal_entries')
            .delete()
            .eq('id', journalEntryId)
          throw new Error(`Journal entry lines failed: ${linesError.message}`)
        }
      } else {
        console.warn(
          '⚠️ Could not find AR (1200) or Cash account — journal entry skipped.',
          'AR found:',
          !!arAccount,
          'Cash found:',
          !!cashAccount,
        )
      }

      // ─── Step 3: Insert cash_flow_transactions ────────────────────────────
      // Drives v_cash_flow — customer payment is an inflow (cash coming in)
      // transaction_type 'receipt' → view maps to 'inflow' ✅
      const { error: cftError } = await supabase
        .from('cash_flow_transactions')
        .insert({
          company_id: customer.company_id,
          transaction_date: new Date().toISOString().split('T')[0],
          transaction_type: 'receipt', // maps to 'inflow' in v_cash_flow view
          activity_type: 'operating',
          description: `Customer credit payment - ${customer.first_name} ${customer.last_name}`,
          amount: amountPaid,
          reference_type: 'credit_payment',
          reference_id: customer.id,
          journal_entry_id: journalEntryId,
          category: 'customer_payment',
          payment_method: values.payment_method,
          notes:
            values.notes ||
            `Credit payment from ${customer.first_name} ${customer.last_name}`,
          created_by: user.id,
        })

      if (cftError) {
        // Rollback journal entry
        if (journalEntryId) {
          await supabase
            .from('journal_entry_lines')
            .delete()
            .eq('journal_entry_id', journalEntryId)
          await supabase
            .from('journal_entries')
            .delete()
            .eq('id', journalEntryId)
        }
        throw new Error(`Cash flow transaction failed: ${cftError.message}`)
      }

      // ─── Step 4: Insert credit_transactions (audit trail) ────────────────
      const { error: creditTxError } = await supabase
        .from('credit_transactions')
        .insert({
          company_id: customer.company_id,
          entity_type: 'customer',
          entity_id: customer.id,
          transaction_type: 'payment',
          reference_type: 'manual',
          transaction_amount: amountPaid,
          balance_before: outstandingBalance,
          balance_after: newBalance,
          payment_method: values.payment_method,
          paid_date: new Date().toISOString().split('T')[0],
          status: 'completed',
          description:
            values.notes ||
            `Credit payment - ${customer.first_name} ${customer.last_name}`,
          notes: values.notes || null,
          created_by: user.id,
          created_at: new Date().toISOString(),
        })

      if (creditTxError) {
        // Rollback
        await supabase
          .from('cash_flow_transactions')
          .delete()
          .eq('reference_type', 'credit_payment')
          .eq('reference_id', customer.id)
        if (journalEntryId) {
          await supabase
            .from('journal_entry_lines')
            .delete()
            .eq('journal_entry_id', journalEntryId)
          await supabase
            .from('journal_entries')
            .delete()
            .eq('id', journalEntryId)
        }
        throw new Error(
          `Credit transaction record failed: ${creditTxError.message}`,
        )
      }

      // ─── Step 5: Update customer balances ────────────────────────────────
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          current_credit_balance: newBalance,
          available_credit: newAvailable,
          total_credit_used: newTotalUsed,
          credit_status: newCreditStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customer.id)

      if (updateError)
        throw new Error(`Failed to update customer: ${updateError.message}`)

      console.log('✅ Customer credit payment complete:', {
        customer: `${customer.first_name} ${customer.last_name}`,
        amountPaid,
        newBalance,
        newAvailable,
        fullyPaid,
        journalEntryId,
      })

      notifications.show({
        title: 'Payment Recorded',
        message: `Payment of ${amountPaid.toLocaleString()} recorded for ${customer.first_name} ${customer.last_name}. ${
          fullyPaid
            ? 'Balance fully cleared! ✅'
            : `Remaining: ${newBalance.toLocaleString()}`
        }`,
        color: 'green',
        autoClose: 6000,
      })

      window.dispatchEvent(new Event('customerUpdated'))
      onClose()
    } catch (error: any) {
      console.error('❌ Error recording customer credit payment:', error)
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to record payment',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }

  const amountEntered = parseFloat(String(form.values.amount || 0))
  const newBalancePreview = Math.max(0, outstandingBalance - amountEntered)
  const newAvailablePreview = creditLimit - newBalancePreview
  const newUtilization =
    creditLimit > 0 ? (newBalancePreview / creditLimit) * 100 : 0

  const sectionStyle = (borderColor: string) => ({
    borderLeft: `4px solid ${borderColor}`,
    marginBottom: '20px',
    backgroundColor: paperBg,
  })

  return (
    <Box
      style={{ display: 'flex', flexDirection: 'column', borderRadius: '12px' }}
    >
      <form
        onSubmit={form.onSubmit(handleSubmit)}
        style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
      >
        {/* ── Customer Information ── */}
        <Paper
          p="20px"
          withBorder
          shadow="sm"
          style={sectionStyle(sectionBorderColor)}
        >
          <Text
            fw={600}
            size="md"
            c="dimmed"
            mb="md"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <IconUser
              size={20}
              color={sectionBorderColor}
            />
            Customer Information
          </Text>
          <Stack gap="sm">
            <Group gap="xs">
              <Text
                size="sm"
                c="dimmed"
                style={{ minWidth: '90px' }}
              >
                Name:
              </Text>
              <Text
                size="sm"
                fw={600}
                c={theme.primaryColor}
              >
                {customer.first_name} {customer.last_name}
              </Text>
            </Group>
            <Group gap="xs">
              <Text
                size="sm"
                c="dimmed"
                style={{ minWidth: '90px' }}
              >
                Phone:
              </Text>
              <Text size="sm">{customer.phone || 'N/A'}</Text>
            </Group>
          </Stack>
        </Paper>

        {/* ── Credit Status ── */}
        <Paper
          p="20px"
          withBorder
          shadow="sm"
          style={sectionStyle(dangerBorderColor)}
        >
          <Text
            fw={600}
            size="md"
            c="dimmed"
            mb="md"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <IconCreditCard
              size={20}
              color={dangerBorderColor}
            />
            Current Credit Status
          </Text>

          <Alert
            icon={<IconInfoCircle size={16} />}
            color={theme.primaryColor}
            variant="light"
            mb="sm"
          >
            <Stack gap="xs">
              <Group justify="space-between">
                <Text
                  size="sm"
                  fw={600}
                >
                  Outstanding Balance:
                </Text>
                <Text
                  size="sm"
                  fw={700}
                  c="red.7"
                >
                  {outstandingBalance.toLocaleString()}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Credit Limit:
                </Text>
                <Text
                  size="xs"
                  fw={500}
                >
                  {creditLimit.toLocaleString()}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Available Credit:
                </Text>
                <Text
                  size="xs"
                  fw={500}
                  c={availableCredit > 0 ? 'green.7' : 'red.7'}
                >
                  {availableCredit.toLocaleString()}
                </Text>
              </Group>
              <Group
                justify="space-between"
                mb={4}
              >
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Utilization:
                </Text>
                <Text
                  size="xs"
                  fw={500}
                  c={utilizationColor}
                >
                  {utilization.toFixed(1)}%
                </Text>
              </Group>
              <Progress
                value={utilization}
                color={utilizationColor}
                size="sm"
                radius="xl"
              />
            </Stack>
          </Alert>

          {/* After-payment preview */}
          {amountEntered > 0 && (
            <Alert
              icon={<IconChartBar size={16} />}
              color="green"
              variant="light"
            >
              <Text
                size="xs"
                fw={600}
                mb="xs"
              >
                After Payment Preview:
              </Text>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    New Balance:
                  </Text>
                  <Text
                    size="xs"
                    fw={600}
                    c="green.7"
                  >
                    {newBalancePreview.toLocaleString()}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    New Available Credit:
                  </Text>
                  <Text
                    size="xs"
                    fw={600}
                    c="green.7"
                  >
                    {newAvailablePreview.toLocaleString()}
                  </Text>
                </Group>
                <Group
                  justify="space-between"
                  mb={4}
                >
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    New Utilization:
                  </Text>
                  <Text
                    size="xs"
                    fw={500}
                  >
                    {newUtilization.toFixed(1)}%
                  </Text>
                </Group>
                <Progress
                  value={newUtilization}
                  color="green"
                  size="sm"
                  radius="xl"
                />
                {newBalancePreview < 0.01 && (
                  <Text
                    size="xs"
                    fw={700}
                    c="green.8"
                    ta="center"
                    mt={4}
                  >
                    ✅ Balance will be fully cleared!
                  </Text>
                )}
              </Stack>
            </Alert>
          )}
        </Paper>

        {/* ── Payment Details ── */}
        <Paper
          p="20px"
          withBorder
          shadow="sm"
          style={sectionStyle(successBorderColor)}
        >
          <Text
            fw={600}
            size="md"
            c="dimmed"
            mb="md"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <IconCash
              size={20}
              color={successBorderColor}
            />
            Payment Details
          </Text>
          <Stack gap="md">
            <NumberInput
              label="Payment Amount"
              placeholder="Enter payment amount"
              required
              min={0.01}
              max={outstandingBalance}
              thousandSeparator=","
              leftSection={<IconCurrencyDollar size={16} />}
              {...form.getInputProps('amount')}
              description={`Maximum: ${outstandingBalance.toLocaleString()}`}
            />
            <Select
              label="Payment Method"
              placeholder="Select payment method"
              required
              leftSection={<IconCash size={16} />}
              data={[
                { value: 'cash', label: 'Cash' },
                { value: 'mobile_money', label: 'Mobile Money' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'cheque', label: 'Cheque' },
                { value: 'card', label: 'Card Payment' },
                { value: 'other', label: 'Other' },
              ]}
              {...form.getInputProps('payment_method')}
              description="How the customer is paying"
            />
            <TextInput
              label="Reference Number"
              placeholder="e.g., Transaction ID, Receipt Number"
              leftSection={<IconFileText size={16} />}
              {...form.getInputProps('reference_number')}
              description="Optional: Transaction reference or receipt number"
            />
            <Textarea
              label="Notes"
              placeholder="Add any additional notes about this payment"
              minRows={2}
              {...form.getInputProps('notes')}
            />
          </Stack>
        </Paper>

        <Group
          justify="center"
          mt="xl"
        >
          <Button
            variant="default"
            size="lg"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            loading={loading}
            leftSection={<IconCheck size={18} />}
            color="green"
            disabled={outstandingBalance <= 0}
          >
            Record Payment
          </Button>
        </Group>
      </form>
    </Box>
  )
}

export default PayCustomerCreditModal

