'use client';

import { Controller } from 'react-hook-form';
import { MenuItem, TextField } from '@mui/material';

export function FormSelect({ control, name, label, options, ...props }) {
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
          select
        >
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  );
}
