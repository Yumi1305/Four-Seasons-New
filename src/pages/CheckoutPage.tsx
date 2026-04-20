import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckoutModal } from "../components/Checkout";

export default function CheckoutPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const order = state?.order;

  useEffect(() => {
    if (!order) navigate("/schedule");
  }, [order, navigate]);

  if (!order) return null;

  return (
    <CheckoutModal
      order={order}
      onClose={() => navigate("/schedule")}
      isMobile={true}
    />
  );
}

