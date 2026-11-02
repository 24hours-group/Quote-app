import { CommonScreens } from './CommonScreens';
import { LocationVehicleServiceScreens } from './LocationVehicleServiceScreens';
import { QuotePaymentHandoffScreens } from './QuotePaymentHandoffScreens';
import { RoadsideServiceScreens } from './RoadsideServiceScreens';
import { TowScreens } from './TowScreens';

export function BookingScreenRenderer(props) {
  return (
    <>
      <CommonScreens {...props} />
      <LocationVehicleServiceScreens {...props} />
      <RoadsideServiceScreens {...props} />
      <TowScreens {...props} />
      <QuotePaymentHandoffScreens {...props} />
    </>
  );
}
