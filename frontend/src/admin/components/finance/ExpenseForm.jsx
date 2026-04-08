import React from 'react';

const ExpenseForm = () => {
    return (
        <div className="card">
            <h3>Log Expense</h3>
            <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
                <input placeholder="Expense Title" style={{ padding: '8px' }} />
                <input placeholder="Amount" type="number" style={{ padding: '8px' }} />
                <button className="btn-primary">Submit Expense</button>
            </div>
        </div>
    );
};

export default ExpenseForm;
