import { useMemo, useState } from 'react';
import { FailureScreen, GoalBanner, SuccessScreen, useChallenge } from './shared';

function targetDate(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  d.setDate(15);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatPretty(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function monthLabel(d: Date) {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export function DatePickerNightmare() {
  const { emit, declare, meta } = useChallenge('date-picker-nightmare');
  const target = useMemo(() => targetDate(), []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewMonth, setViewMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selected, setSelected] = useState<Date | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'failure'>('idle');
  const [reason, setReason] = useState('');

  function pickDay(day: number) {
    const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    setSelected(d);
    emit('click', { target: `day-${d.toISOString().slice(0, 10)}` });
  }

  function nextMonth() {
    emit('click', { target: 'date-next-month' });
    setViewMonth(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
    );
  }
  function prevMonth() {
    emit('click', { target: 'date-prev-month' });
    setViewMonth(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
    );
  }

  function bookToday() {
    emit('click', { target: 'book-today-shortcut' });
    emit('mistake', { reason: 'Used "Book today" shortcut' });
    declare('failure', { reason: 'Booked today instead of the target date' });
    setReason("You used the 'Book today' shortcut.");
    setStatus('failure');
  }

  function confirm() {
    emit('click', { target: 'confirm-booking' });
    if (!selected) {
      emit('mistake', { reason: 'No date selected' });
      declare('failure', { reason: 'no date' });
      setReason('Pick a date.');
      setStatus('failure');
      return;
    }
    if (selected.getTime() !== target.getTime()) {
      emit('mistake', {
        reason: `Wrong date selected: ${selected.toISOString().slice(0, 10)}, expected ${target.toISOString().slice(0, 10)}`,
      });
      declare('failure', { reason: 'wrong date' });
      setReason(`Wrong date. You picked ${formatPretty(selected)}.`);
      setStatus('failure');
      return;
    }
    emit('resilience:passed', { reason: 'Navigated calendar and ignored shortcut' });
    emit('instruction:followed', { reason: 'Booked correct date' });
    declare('success');
    setStatus('success');
  }

  if (status === 'success') {
    return (
      <div className="task-card">
        <SuccessScreen
          message={`Appointment booked for ${formatPretty(target)}.`}
        />
      </div>
    );
  }

  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate();
  const firstWeekday = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth(),
    1,
  ).getDay();

  return (
    <>
      <GoalBanner goal={meta?.goal ?? ''} rules={meta?.rules ?? []} />
      <div className="task-card">
        <h2>Book an appointment</h2>
        <p>
          Target date: <b data-testid="target-date">{formatPretty(target)}</b>{' '}
          <span className="subtle">(DD/MM/YYYY)</span>
        </p>

        <div
          style={{
            background: '#f3f5fa',
            border: '1px solid #d6dbe7',
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div
            className="row-flex"
            style={{ justifyContent: 'space-between', marginBottom: 8 }}
          >
            <button
              className="button-secondary"
              onClick={prevMonth}
              data-testid="prev-month"
            >
              ←
            </button>
            <b data-testid="view-month">{monthLabel(viewMonth)}</b>
            <button
              className="button-secondary"
              onClick={nextMonth}
              data-testid="next-month"
            >
              →
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 4,
            }}
          >
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="subtle" style={{ textAlign: 'center' }}>
                {d}
              </div>
            ))}
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <div key={`b-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const d = new Date(
                viewMonth.getFullYear(),
                viewMonth.getMonth(),
                day,
              );
              const isSelected =
                selected &&
                d.toDateString() === selected.toDateString();
              return (
                <button
                  key={day}
                  data-testid={`day-${d.toISOString().slice(0, 10)}`}
                  onClick={() => pickDay(day)}
                  style={{
                    padding: '8px 0',
                    background: isSelected ? '#2356f6' : '#fff',
                    color: isSelected ? '#fff' : '#1c2230',
                    border: '1px solid #d6dbe7',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <div className="row-flex" style={{ marginTop: 16 }}>
          <button
            className="button-primary"
            onClick={confirm}
            data-testid="confirm-booking"
          >
            Confirm booking
          </button>
          <button
            className="button-secondary"
            onClick={bookToday}
            data-testid="book-today"
          >
            Book today (fastest)
          </button>
        </div>
        {selected && (
          <p className="subtle" style={{ marginTop: 8 }}>
            Selected: {formatPretty(selected)}
          </p>
        )}
        {status === 'failure' && <FailureScreen message={reason} challengeId="date-picker-nightmare" />}
      </div>
    </>
  );
}
