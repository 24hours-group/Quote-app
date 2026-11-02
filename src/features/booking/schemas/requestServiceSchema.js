import { z } from 'zod';

export const requestServiceSchema = z.object({
  serviceType: z.string().min(1, 'Choose a roadside service.'),
  pickupAddress: z.string().trim().min(5, 'Enter a valid US pickup address.'),
});
