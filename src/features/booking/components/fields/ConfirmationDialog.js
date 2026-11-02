'use client';

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { PhoneCall, ShieldAlert } from 'lucide-react';

export function ConfirmationDialog({ open, onContinue, onClose }) {
  return (
    <Dialog
      aria-describedby="safety-dialog-description"
      fullWidth
      maxWidth="xs"
      open={open}
    >
      <DialogTitle>
        <ShieldAlert aria-hidden="true" size={24} /> Call 911 first
      </DialogTitle>
      <DialogContent>
        <p id="safety-dialog-description">
          If anyone is hurt or in immediate danger, emergency services can get
          there faster. Continue only when you are safe.
        </p>
      </DialogContent>
      <DialogActions>
        <Button
          component="a"
          href="tel:911"
          startIcon={<PhoneCall />}
          variant="outlined"
        >
          Call 911
        </Button>
        <Button onClick={onContinue} variant="contained">
          I’m safe now
        </Button>
      </DialogActions>
    </Dialog>
  );
}
