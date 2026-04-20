export function getSquareConfig() {
  return {
    applicationId: import.meta.env.VITE_SQUARE_APPLICATION_ID ?? "",
    locationId: import.meta.env.VITE_SQUARE_LOCATION_ID ?? "",
    paymentApiUrl: import.meta.env.VITE_SQUARE_PAYMENT_API_URL ?? "",
  };
}
