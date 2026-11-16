import {
  BatteryCharging,
  Car,
  CircleHelp,
  ClipboardCheck,
  Fuel,
  KeyRound,
  LifeBuoy,
  RotateCcw,
  ShieldCheck,
  Siren,
  Wrench,
} from 'lucide-react';

export const entryOptions = [
  {
    value: 'new',
    label: 'Get help now',
    description: 'Start a new roadside request',
    icon: LifeBuoy,
  },
  {
    value: 'existing',
    label: 'Request a status update',
    description: 'Ask the team handling your booking to contact you',
    icon: ClipboardCheck,
  },
  {
    value: 'cancel',
    label: 'Request cancellation review',
    description: 'Ask an agent to review cancellation and refund options',
    icon: RotateCcw,
  },
];

export const serviceOptions = [
  {
    value: 'jump_start',
    label: 'Jump start',
    description: 'Dead battery',
    icon: BatteryCharging,
  },
  {
    value: 'flat_tire',
    label: 'Flat tire',
    description: 'Change or replace a tire',
    icon: LifeBuoy,
  },
  {
    value: 'locked_out',
    label: 'Locked out',
    description: 'Keys inside the vehicle',
    icon: KeyRound,
  },
  { value: 'tow', label: 'Tow', description: 'Move my vehicle', icon: Car },
  {
    value: 'out_of_gas',
    label: 'Out of gas',
    description: 'Fuel delivery',
    icon: Fuel,
  },
  {
    value: 'mechanic_check',
    label: 'Mechanic check',
    description: 'Something is wrong',
    icon: Wrench,
  },
  {
    value: 'stuck',
    label: 'Stuck',
    description: 'Mud, sand, or ditch',
    icon: Siren,
  },
  {
    value: 'other',
    label: 'Something else',
    description: 'Talk to a specialist',
    icon: CircleHelp,
  },
];

export const safetyOptions = [
  {
    value: true,
    label: "Yes, I'm safe",
    description: 'Continue with roadside help',
    icon: ShieldCheck,
  },
  {
    value: false,
    label: 'No, or someone is injured',
    description: 'Call 911 before continuing',
    icon: Siren,
  },
];
