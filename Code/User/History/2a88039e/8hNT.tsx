import { Control, Controller, FieldValues, Path } from 'react-hook-form'
import { DateTimePicker, DateTimePickerProps } from '@mantine/dates'
import { Stack, Text } from '@mantine/core'
import { SavedColors } from '@shared/constants'
import { parseDDMMYYYY } from 'src/shared/utils/dateParser'

interface Props<T extends FieldValues> extends Omit<
  DateTimePickerProps,
  'value' | 'onChange' | 'error' | 'name'
> {
  control: Control<T>
  name: Path<T>
  label?: string
  mb?: number
  labelColor?: string
}

const FormDateTimePicker = <T extends FieldValues>({
  control,
  name,
  label,
  mb = 0,
  labelColor = SavedColors.TextColor,
  ...rest
}: Props<T>) => (
  <Stack
    gap={3}
    mb={mb}
    w="100%"
  >
    {label && (
      <Text
        size="sm"
        fw={500}
        style={{ color: labelColor }}
      >
        {label}
      </Text>
    )}
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <>
          <DateTimePicker
            {...rest}
            value={field.value}
            onChange={field.onChange}
            error={Boolean(error)}
            radius={3}
            dateParser={parseDDMMYYYY}
            valueFormat="DD/MM/YYYY HH:mm"
            placeholder={rest.placeholder ?? 'DD/MM/YYYY HH:mm'}
          />
          {error && (
            <Text
              c="red"
              size="xs"
              mt={2}
            >
              {error.message}
            </Text>
          )}
        </>
      )}
    />
  </Stack>
)

export default FormDateTimePicker
export { FormDateTimePicker }

