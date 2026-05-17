import { Routes, Route } from "react-router-dom";

import Header from "./components/Header";
import Footer from "./components/Footer";

import HomePage from "./pages/HomePage";
import MenuPage from "./pages/MenuPage";
import SchedulePage from "./pages/SchedulePage";
import Schedule2Page from "./pages/Schedule2Page";
import ScheduleOrderPage from "./pages/ScheduleOrderPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderPage from "./pages/OrderPage";
import AdminPage from "./pages/AdminPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminRoute from "./components/AdminRoute";
import PaymentConfirmation from "./pages/PaymentConfirmation"; 

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/schedule2" element={<Schedule2Page />} />
        <Route path="/schedule/order" element={<ScheduleOrderPage />} />
        <Route path="/schedule/checkout" element={<CheckoutPage />} />
        <Route path="/order" element={<OrderPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/payment-confirmation" element={<PaymentConfirmation/>} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
      </Routes>
      <Footer />
    </>
  );
}
