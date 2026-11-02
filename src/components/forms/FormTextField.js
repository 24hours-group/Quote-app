'use client';

import { Controller } from 'react-hook-form';
import { TextField } from '@mui/material';

export function FormTextField({ control, name, label, ...props }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          {...props}
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message || props.helperText}
          label={label}
        />
      )}
    />
  );
}
