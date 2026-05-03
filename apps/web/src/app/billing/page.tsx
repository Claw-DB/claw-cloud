// Billing page — plan selection, invoices, and usage charts
export default function BillingPage() {
  return (
    <section className="page">
      <header className="hero">
        <h1>Billing &amp; Usage</h1>
        <p>Track usage and costs with clear per-metric spend visibility.</p>
      </header>
      <div className="grid">
        <article className="card span-6">
          <h3>Current Plan</h3>
          <p>
            <strong>Pro</strong> with annual billing
          </p>
          <p>Renews on 2026-01-01</p>
        </article>
        <article className="card span-6">
          <h3>Month-to-date</h3>
          <div className="kpi">$1,248</div>
          <p>Estimated final: $1,412</p>
        </article>
        <article className="card span-12">
          <h3>Top Cost Drivers</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Usage</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Compute Minutes</td>
                <td>98,214</td>
                <td>$540</td>
              </tr>
              <tr>
                <td>Storage GB-Hours</td>
                <td>318,404</td>
                <td>$372</td>
              </tr>
              <tr>
                <td>Vector Ops</td>
                <td>14,812,122</td>
                <td>$214</td>
              </tr>
            </tbody>
          </table>
        </article>
      </div>
    </section>
  );
}
