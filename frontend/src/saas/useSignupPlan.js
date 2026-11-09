import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { readSignupPlan, retainSignupPlan, SIGNUP_PLAN_KEY } from './signupIntent';

export function useSignupPlan() {
  const { search } = useLocation();
  const plan = useMemo(() => {
    let saved;
    try { saved = sessionStorage.getItem(SIGNUP_PLAN_KEY); }
    catch { /* The URL can supply the choice without browser storage. */ }
    return readSignupPlan(search, saved);
  }, [search]);
  useEffect(() => {
    try { retainSignupPlan(sessionStorage, plan); }
    catch { /* The query string remains available without session storage. */ }
  }, [plan]);
  return plan;
}
