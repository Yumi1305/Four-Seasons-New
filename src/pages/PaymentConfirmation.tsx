import { useLocation, useNavigate } from "react-router-dom";

function PaymentConfirmation(){
  const {state} = useLocation();
  const navigate = useNavigate(); 
  
  if (!state?.orderId){
    return(
    <div style={
        {
          height: '100vh'
        }
      }>
      <div>
        order failed
      </div>
      <button onClick={()=>{navigate('/')}}>Go home</button>
    </div>
    )
  }

  const {customerName, orderId, grade, eventName, eventDateLabel, lunchSlot, main, side1, side2, totalPaid} = state; 
  return(
    <main className="page-content confirmation-page">
      <div className="container confirmation-box" id="receipt">
        <div className="confirmation-header">
          <h1>Order Confirmed!</h1>
          <p className="confirmation-sub">Thank you, {customerName}. Your lunch is reserved.</p>
        </div>

        <div className="confirmation-section">
          <h2>Order Details</h2>
          <table className="receipt-table">
            <tbody>
              <tr><td>Confirmation #</td><td><strong>{orderId}</strong></td></tr>
              <tr><td>Name</td><td>{customerName}</td></tr>
              <tr><td>Grade</td><td>{grade}</td></tr>
              <tr><td>Event</td><td>{eventName}</td></tr>
              <tr><td>Date</td><td>{eventDateLabel}</td></tr>
              <tr><td>Lunch Slot</td><td>Slot {lunchSlot}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="confirmation-section">
          <h2>Your Order</h2>
          <table className="receipt-table">
            <tbody>
              {main && <tr><td>{main.name} <span className="receipt-tag">main</span></td><td>${main.price.toFixed(2)}</td></tr>}
              {side1 && <tr><td>{side1.name}</td><td>+${side1.price.toFixed(2)}</td></tr>}
              {side2 && <tr><td>{side2.name}</td><td>+${side2.price.toFixed(2)}</td></tr>}
              <tr className="receipt-total"><td><strong>Total Paid</strong></td><td><strong>${totalPaid.toFixed(2)}</strong></td></tr>
            </tbody>
          </table>
        </div>

        <div className="confirmation-actions no-print">
          <button className="btn-primary" onClick={() => window.print()}>
            Download Receipt
          </button>
          <button className="btn-secondary" onClick={() => navigate("/")}>
            Return to Home
          </button>
        </div>
      </div>
    </main>
  )
}

export default PaymentConfirmation; 