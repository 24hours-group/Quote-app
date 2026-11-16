import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VehicleCatalogFields } from '@/features/booking/components/fields/VehicleCatalogFields';

describe('vehicle catalog fields', () => {
  it('offers local model suggestions while preserving custom entry', () => {
    const setAnswer = vi.fn();
    const setAnswers = vi.fn();
    render(
      <VehicleCatalogFields
        answers={{ year: '2019', make: 'Honda', model: '' }}
        errors={{}}
        setAnswer={setAnswer}
        setAnswers={setAnswers}
      />,
    );

    expect(screen.getByLabelText('Year')).toHaveAttribute('list');
    expect(screen.getByLabelText('Make')).toHaveAttribute('list');
    expect(screen.getByLabelText('Model')).toHaveAttribute('list');
    expect(document.querySelector('option[value="CR-V"]')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Make'), {
      target: { value: 'Custom Coachworks' },
    });
    expect(setAnswers).toHaveBeenCalledWith({
      make: 'Custom Coachworks',
      model: undefined,
    });
  });

  it('accepts a fully custom vehicle outside the local catalog', () => {
    const setAnswer = vi.fn();
    const setAnswers = vi.fn();
    render(
      <VehicleCatalogFields
        answers={{}}
        errors={{}}
        setAnswer={setAnswer}
        setAnswers={setAnswers}
      />,
    );

    fireEvent.change(screen.getByLabelText('Year'), {
      target: { value: '1972' },
    });
    fireEvent.change(screen.getByLabelText('Make'), {
      target: { value: 'Custom Coachworks' },
    });
    fireEvent.change(screen.getByLabelText('Model'), {
      target: { value: 'Roadster Special' },
    });

    expect(setAnswer).toHaveBeenCalledWith('year', '1972');
    expect(setAnswers).toHaveBeenCalledWith({
      make: 'Custom Coachworks',
      model: undefined,
    });
    expect(setAnswer).toHaveBeenCalledWith('model', 'Roadster Special');
  });

  it('collects an optional local or custom vehicle color', () => {
    const setAnswer = vi.fn();
    render(
      <VehicleCatalogFields
        answers={{}}
        errors={{}}
        setAnswer={setAnswer}
        setAnswers={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Vehicle color (optional)'), {
      target: { value: 'Pearl White' },
    });
    expect(setAnswer).toHaveBeenCalledWith('vehicleColor', 'Pearl White');
  });
});
