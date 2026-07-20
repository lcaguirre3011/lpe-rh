import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileClock,
  Grid2X2,
  History,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Table2,
  UserCog,
  UserRound,
  UsersRound,
  X
} from 'lucide-react';
import { supabase } from './lib/supabase';
import './styles.css';

const ROLE_LABELS = {
  admin: 'Administrador',
  hr: 'RH',
  finance: 'Finanzas / Nomina',
  supervisor: 'Supervisor',
  read_only: 'Solo lectura'
};

const STATUS_LABELS = {
  active: 'Activo',
  terminated: 'Baja',
  medical_leave: 'Incapacidad',
  vacation: 'Vacaciones',
  suspended: 'Suspendido',
  inactive: 'Inactivo'
};

const PAYMENT_LABELS = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  commission: 'Comision',
  other: 'Otro'
};

const AUTH_LABELS = {
  salary_change: 'Cambio salarial',
  termination: 'Baja de empleado',
  rehire: 'Reingreso',
  partner_change: 'Cambio de asociado'
};

const AUTH_STATUS_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada'
};

const blankEmployee = {
  full_name: '',
  curp: '',
  rfc: '',
  nss: '',
  email: '',
  phone: '',
  secondary_phone: '',
  address: '',
  department_id: '',
  position_id: '',
  position: '',
  department: '',
  hire_date: '',
  partner_id: '',
  new_partner_name: '',
  new_partner_rfc: '',
  pay_rate_id: '',
  new_department_name: '',
  new_position_name: '',
  new_pay_rate_name: '',
  new_pay_rate_amount: '',
  vacation_days: 12,
  payment_type: 'monthly',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relationship: '',
  notes: ''
};

const blankPartner = {
  name: '',
  legal_name: '',
  rfc: '',
  contact_name: '',
  phone: '',
  notes: '',
  is_active: true
};

function money(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function shortDate(value) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}

function yearsBetween(value) {
  if (!value) return 0;
  const start = new Date(value);
  const diff = Date.now() - start.getTime();
  return Math.max(0, diff / (365.25 * 24 * 60 * 60 * 1000));
}

function can(profile, action) {
  const role = profile?.role;
  const rules = {
    manageEmployees: ['admin', 'hr'],
    managePartners: ['admin', 'hr'],
    viewSalary: ['admin', 'hr', 'finance'],
    requestSalary: ['admin', 'hr', 'finance'],
    requestTermination: ['admin', 'hr', 'supervisor'],
    requestRehire: ['admin', 'hr'],
    requestPartnerChange: ['admin', 'hr'],
    approveSalary: ['admin', 'finance'],
    approveEmployee: ['admin', 'hr'],
    viewAudit: ['admin', 'hr', 'finance'],
    manageUsers: ['admin']
  };
  return Boolean(profile?.is_active) && rules[action]?.includes(role);
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('dashboard');
  const [displayMode, setDisplayMode] = useState('table');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ status: '', partner_id: '', department: '', position: '' });
  const [employees, setEmployees] = useState([]);
  const [partners, setPartners] = useState([]);
  const [departmentCatalog, setDepartmentCatalog] = useState([]);
  const [positionCatalog, setPositionCatalog] = useState([]);
  const [payRates, setPayRates] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [expenseReports, setExpenseReports] = useState([]);
  const [compensation, setCompensation] = useState([]);
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [userProfiles, setUserProfiles] = useState([]);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadData();
    } else {
      setProfile(null);
      setEmployees([]);
      setPartners([]);
      setDepartmentCatalog([]);
      setPositionCatalog([]);
      setPayRates([]);
      setShifts([]);
      setAttendanceRecords([]);
      setExpenseReports([]);
      setCompensation([]);
      setRequests([]);
      setHistory([]);
      setUserProfiles([]);
    }
  }, [session?.user?.id]);

  const employeeRows = useMemo(() => {
    const salaryByEmployee = new Map(compensation.map((item) => [item.employee_id, item]));
    const partnerById = new Map(partners.map((item) => [item.id, item]));
    const departmentById = new Map(departmentCatalog.map((item) => [item.id, item]));
    const positionById = new Map(positionCatalog.map((item) => [item.id, item]));
    const payRateById = new Map(payRates.map((item) => [item.id, item]));
    return employees.map((employee) => ({
      ...employee,
      partner: partnerById.get(employee.partner_id),
      departmentRecord: departmentById.get(employee.department_id),
      positionRecord: positionById.get(employee.position_id),
      payRate: payRateById.get(employee.pay_rate_id),
      department_name: departmentById.get(employee.department_id)?.name || employee.department || '',
      position_name: positionById.get(employee.position_id)?.name || employee.position || '',
      compensation: salaryByEmployee.get(employee.id)
    }));
  }, [employees, partners, departmentCatalog, positionCatalog, payRates, compensation]);

  const filteredEmployees = useMemo(() => {
    const text = query.trim().toLowerCase();
    return employeeRows.filter((employee) => {
      const matchesText = !text || [
        employee.employee_code,
        employee.full_name,
        employee.curp,
        employee.rfc,
        employee.nss,
        employee.email,
        employee.phone,
        employee.secondary_phone,
        employee.emergency_contact_name,
        employee.position_name,
        employee.department_name,
        employee.partner?.name
      ].some((value) => String(value || '').toLowerCase().includes(text));

      return matchesText
        && (!filters.status || employee.status === filters.status)
        && (!filters.partner_id || employee.partner_id === filters.partner_id)
        && (!filters.department || employee.department_id === filters.department)
        && (!filters.position || employee.position_id === filters.position);
    });
  }, [employeeRows, filters, query]);

  const metrics = useMemo(() => {
    const total = employeeRows.length;
    const active = employeeRows.filter((employee) => employee.status === 'active').length;
    const terminated = employeeRows.filter((employee) => employee.status === 'terminated').length;
    const incomplete = employeeRows.filter((employee) => !employee.curp || !employee.rfc || !employee.nss || !employee.partner_id).length;
    const pending = requests.filter((request) => request.status === 'pending').length;
    const salaryTotal = employeeRows.reduce((sum, employee) => sum + Number(employee.compensation?.current_salary || 0), 0);
    const averageSeniority = total
      ? employeeRows.reduce((sum, employee) => sum + yearsBetween(employee.hire_date), 0) / total
      : 0;

    return {
      total,
      active,
      terminated,
      incomplete,
      pending,
      salaryTotal,
      averageSeniority,
      rotation: total ? Math.round((terminated / total) * 100) : 0
    };
  }, [employeeRows, requests]);

  const departments = useMemo(() => departmentCatalog.filter((item) => item.is_active), [departmentCatalog]);
  const positions = useMemo(() => positionCatalog.filter((item) => item.is_active), [positionCatalog]);

  async function loadData() {
    if (!session?.user) return;
    setRefreshing(true);
    setError('');

    try {
      const profileResult = await supabase
        .from('hr_user_profiles')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();
      if (profileResult.error) throw profileResult.error;

      const nextProfile = profileResult.data;
      setProfile(nextProfile);

      const [
        partnersResult,
        departmentsResult,
        positionsResult,
        payRatesResult,
        shiftsResult,
        attendanceResult,
        expensesResult,
        employeesResult,
        requestsResult,
        historyResult
      ] = await Promise.all([
        supabase.from('hr_partners').select('*').order('name', { ascending: true }),
        supabase.from('hr_departments').select('*').order('name', { ascending: true }),
        supabase.from('hr_positions').select('*').order('name', { ascending: true }),
        supabase.from('hr_pay_rates').select('*').order('name', { ascending: true }),
        supabase.from('hr_shifts').select('*').order('name', { ascending: true }),
        supabase.from('hr_attendance_records').select('*').order('work_date', { ascending: false }).limit(200),
        supabase.from('hr_expense_reports').select('*').order('created_at', { ascending: false }).limit(120),
        supabase.from('hr_employees').select('*').order('created_at', { ascending: false }),
        supabase.from('hr_authorization_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('hr_employee_history').select('*').order('created_at', { ascending: false }).limit(80)
      ]);

      for (const result of [
        partnersResult,
        departmentsResult,
        positionsResult,
        payRatesResult,
        shiftsResult,
        attendanceResult,
        expensesResult,
        employeesResult,
        requestsResult,
        historyResult
      ]) {
        if (result.error) throw result.error;
      }

      setPartners(partnersResult.data || []);
      setDepartmentCatalog(departmentsResult.data || []);
      setPositionCatalog(positionsResult.data || []);
      setPayRates(payRatesResult.data || []);
      setShifts(shiftsResult.data || []);
      setAttendanceRecords(attendanceResult.data || []);
      setExpenseReports(expensesResult.data || []);
      setEmployees(employeesResult.data || []);
      setRequests(requestsResult.data || []);
      setHistory(historyResult.data || []);

      if (can(nextProfile, 'manageUsers')) {
        const usersResult = await supabase.rpc('hr_admin_user_directory');
        if (usersResult.error) throw usersResult.error;
        setUserProfiles(usersResult.data || []);
      } else {
        setUserProfiles([]);
      }

      if (can(nextProfile, 'viewSalary')) {
        const compensationResult = await supabase.from('hr_employee_compensation').select('*');
        if (compensationResult.error) throw compensationResult.error;
        setCompensation(compensationResult.data || []);
      } else {
        setCompensation([]);
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar la informacion.');
    } finally {
      setRefreshing(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return <ShellFrame><div className="center-state">Cargando LPE RH...</div></ShellFrame>;
  }

  if (!session) {
    return <LoginScreen />;
  }

  if ((!profile || !profile.is_active) && !refreshing) {
    return (
      <ShellFrame>
        <div className="access-panel">
          <ShieldCheck size={42} />
          <h1>Perfil pendiente</h1>
          <p>Tu usuario existe en Supabase Auth, pero todavia no tiene perfil RH activo.</p>
          <button className="primary-btn" onClick={loadData}>
            <RefreshCw size={18} /> Revisar de nuevo
          </button>
          <button className="ghost-btn" onClick={signOut}>
            <LogOut size={18} /> Salir
          </button>
        </div>
      </ShellFrame>
    );
  }

  return (
    <ShellFrame>
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-logo" src="/brand/lpe-horizontal-negativo.png" alt="LPE Transporte" />
          <div>
            <strong>Recursos Humanos</strong>
            <span>Control interno</span>
          </div>
        </div>

        <nav className="nav-list">
          <NavButton active={view === 'dashboard'} icon={<LayoutDashboard />} label="Dashboard" onClick={() => setView('dashboard')} />
          <NavButton active={view === 'employees'} icon={<UsersRound />} label="Empleados" onClick={() => setView('employees')} />
          <NavButton active={view === 'partners'} icon={<Building2 />} label="Asociados" onClick={() => setView('partners')} />
          <NavButton active={view === 'authorizations'} icon={<ShieldCheck />} label="Autorizaciones" onClick={() => setView('authorizations')} />
          <NavButton active={view === 'history'} icon={<History />} label="Historial" onClick={() => setView('history')} />
          {can(profile, 'manageUsers') && <NavButton active={view === 'users'} icon={<UserCog />} label="Usuarios" onClick={() => setView('users')} />}
        </nav>

        <div className="user-block">
          <div className="user-avatar">{profile?.full_name?.slice(0, 1) || 'U'}</div>
          <div>
            <strong>{profile?.full_name || session.user.email}</strong>
            <span>{ROLE_LABELS[profile?.role] || 'Usuario'}</span>
          </div>
          <button className="icon-btn" title="Salir" onClick={signOut}><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">LPE Transporte</p>
            <h1>{titleFor(view)}</h1>
          </div>
          <div className="topbar-actions">
            {error && <span className="error-pill">{error}</span>}
            <button className="ghost-btn" onClick={loadData} disabled={refreshing}>
              <RefreshCw size={18} className={refreshing ? 'spin' : ''} /> Actualizar
            </button>
          </div>
        </header>

        {view === 'dashboard' && (
          <Dashboard
            metrics={metrics}
            employeeRows={employeeRows}
            partners={partners}
            requests={requests}
            shifts={shifts}
            attendanceRecords={attendanceRecords}
            expenseReports={expenseReports}
            profile={profile}
            onOpenEmployees={(nextFilters) => {
              setFilters((current) => ({ ...current, ...nextFilters }));
              setView('employees');
            }}
            onOpenRequests={() => setView('authorizations')}
          />
        )}

        {view === 'employees' && (
          <EmployeesView
            profile={profile}
            employees={filteredEmployees}
            partners={partners}
            filters={filters}
            departments={departments}
            positions={positions}
            payRates={payRates}
            displayMode={displayMode}
            query={query}
            onQuery={setQuery}
            onFilters={setFilters}
            onDisplayMode={setDisplayMode}
            onCreate={() => setModal({ type: 'employee', mode: 'create', value: blankEmployee })}
            onEdit={(employee) => setModal({ type: 'employee', mode: 'edit', value: mapEmployeeToForm(employee) })}
            onSensitive={(action, employee) => setModal({ type: action, employee, value: sensitiveDefaults(action, employee) })}
            onClearFilters={() => {
              setFilters({ status: '', partner_id: '', department: '', position: '' });
              setQuery('');
            }}
          />
        )}

        {view === 'partners' && (
          <PartnersView
            profile={profile}
            partners={partners}
            employees={employeeRows}
            onCreate={() => setModal({ type: 'partner', mode: 'create', value: blankPartner })}
            onEdit={(partner) => setModal({ type: 'partner', mode: 'edit', value: { ...partner } })}
          />
        )}

        {view === 'authorizations' && (
          <AuthorizationsView
            profile={profile}
            requests={requests}
            employees={employeeRows}
            onApprove={(request) => handleApprove(request)}
            onReject={(request) => setModal({ type: 'reject', request, value: { rejection_reason: '' } })}
          />
        )}

        {view === 'history' && (
          <HistoryView history={history} employees={employeeRows} />
        )}

        {view === 'users' && can(profile, 'manageUsers') && (
          <UsersAdminView
            users={userProfiles}
            currentUserId={session.user.id}
            onSave={(user, value) => saveUserProfile(user, value)}
          />
        )}
      </main>

      {modal && (
        <Modal onClose={() => setModal(null)}>
          {modal.type === 'employee' && (
            <EmployeeForm
              mode={modal.mode}
              value={modal.value}
              partners={partners}
              departments={departments}
              positions={positions}
              payRates={payRates}
              onCancel={() => setModal(null)}
              onSubmit={(value) => saveEmployee(modal.mode, value)}
            />
          )}

          {modal.type === 'partner' && (
            <PartnerForm
              mode={modal.mode}
              value={modal.value}
              onCancel={() => setModal(null)}
              onSubmit={(value) => savePartner(modal.mode, value)}
            />
          )}

          {['salary_change', 'termination', 'rehire', 'partner_change'].includes(modal.type) && (
            <SensitiveForm
              type={modal.type}
              employee={modal.employee}
              value={modal.value}
              partners={partners}
              onCancel={() => setModal(null)}
              onSubmit={(value) => requestSensitiveChange(modal.type, modal.employee, value)}
            />
          )}

          {modal.type === 'reject' && (
            <RejectForm
              request={modal.request}
              value={modal.value}
              onCancel={() => setModal(null)}
              onSubmit={(value) => rejectRequest(modal.request, value)}
            />
          )}
        </Modal>
      )}
    </ShellFrame>
  );

  async function saveEmployee(mode, value) {
    setError('');
    try {
      validateEmployeeForm(value);
      const resolved = await resolveEmployeeCatalogs(value);
      const payload = normalizeEmployee(resolved, session.user.id, mode);
      const result = mode === 'create'
        ? await supabase.from('hr_employees').insert(payload)
        : await supabase.from('hr_employees').update(payload).eq('id', value.id);
      if (result.error) throw result.error;
      setModal(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el empleado.');
    }
  }

  async function resolveEmployeeCatalogs(value) {
    const next = { ...value };

    if (next.department_id === '__new') {
      const result = await supabase
        .from('hr_departments')
        .insert({
          name: next.new_department_name.trim(),
          created_by: session.user.id,
          updated_by: session.user.id
        })
        .select('id')
        .single();
      if (result.error) throw result.error;
      next.department_id = result.data.id;
    }

    if (next.position_id === '__new') {
      const result = await supabase
        .from('hr_positions')
        .insert({
          department_id: next.department_id,
          name: next.new_position_name.trim(),
          created_by: session.user.id,
          updated_by: session.user.id
        })
        .select('id')
        .single();
      if (result.error) throw result.error;
      next.position_id = result.data.id;
    }

    if (next.partner_id === '__new') {
      const result = await supabase
        .from('hr_partners')
        .insert({
          name: next.new_partner_name.trim(),
          rfc: clean(next.new_partner_rfc),
          created_by: session.user.id,
          updated_by: session.user.id
        })
        .select('id')
        .single();
      if (result.error) throw result.error;
      next.partner_id = result.data.id;
    }

    if (next.pay_rate_id === '__new') {
      const result = await supabase
        .from('hr_pay_rates')
        .insert({
          name: next.new_pay_rate_name.trim(),
          payment_type: next.payment_type,
          amount: Number(next.new_pay_rate_amount || 0),
          vacation_days: Number(next.vacation_days || 0),
          created_by: session.user.id,
          updated_by: session.user.id
        })
        .select('id')
        .single();
      if (result.error) throw result.error;
      next.pay_rate_id = result.data.id;
    }

    return next;
  }

  async function savePartner(mode, value) {
    setError('');
    const payload = {
      name: value.name.trim(),
      legal_name: clean(value.legal_name),
      rfc: clean(value.rfc),
      contact_name: clean(value.contact_name),
      phone: clean(value.phone),
      notes: clean(value.notes),
      is_active: Boolean(value.is_active),
      updated_by: session.user.id
    };
    if (mode === 'create') payload.created_by = session.user.id;

    try {
      const result = mode === 'create'
        ? await supabase.from('hr_partners').insert(payload)
        : await supabase.from('hr_partners').update(payload).eq('id', value.id);
      if (result.error) throw result.error;
      setModal(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el asociado.');
    }
  }

  async function requestSensitiveChange(type, employee, value) {
    setError('');
    const rpcByType = {
      salary_change: ['hr_request_salary_change', {
        p_employee_id: employee.id,
        p_new_salary: Number(value.new_salary || 0),
        p_reason: value.reason
      }],
      termination: ['hr_request_employee_termination', {
        p_employee_id: employee.id,
        p_termination_date: value.termination_date,
        p_reason: value.reason
      }],
      rehire: ['hr_request_employee_rehire', {
        p_employee_id: employee.id,
        p_hire_date: value.hire_date,
        p_reason: value.reason
      }],
      partner_change: ['hr_request_partner_change', {
        p_employee_id: employee.id,
        p_new_partner_id: value.partner_id,
        p_reason: value.reason
      }]
    };

    const [rpcName, params] = rpcByType[type];
    try {
      const result = await supabase.rpc(rpcName, params);
      if (result.error) throw result.error;
      setModal(null);
      setView('authorizations');
      await loadData();
    } catch (err) {
      setError(err.message || 'No se pudo crear la solicitud.');
    }
  }

  async function handleApprove(request) {
    setError('');
    try {
      const result = await supabase.rpc('hr_approve_authorization_request', {
        p_request_id: request.id,
        p_comment: null
      });
      if (result.error) throw result.error;
      await loadData();
    } catch (err) {
      setError(err.message || 'No se pudo aprobar la solicitud.');
    }
  }

  async function rejectRequest(request, value) {
    setError('');
    try {
      const result = await supabase.rpc('hr_reject_authorization_request', {
        p_request_id: request.id,
        p_rejection_reason: value.rejection_reason
      });
      if (result.error) throw result.error;
      setModal(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'No se pudo rechazar la solicitud.');
    }
  }

  async function saveUserProfile(user, value) {
    setError('');
    try {
      const result = await supabase.rpc('hr_admin_upsert_user_profile', {
        target_auth_user_id: user.auth_user_id,
        target_full_name: value.full_name,
        target_role: value.role,
        target_is_active: value.is_active
      });
      if (result.error) throw result.error;
      await loadData();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el usuario.');
    }
  }
}

function LoginScreen() {
  const [email, setEmail] = useState('lcaguirre@lc-leadingconnections.com');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) setError(signInError.message);
  }

  return (
    <ShellFrame>
      <div className="login-page">
        <section className="login-intro">
          <img className="login-logo" src="/brand/lpe-horizontal-negativo.png" alt="LPE Transporte" />
          <p className="eyebrow">LPE Transporte</p>
          <h1>Recursos Humanos</h1>
          <p>Control de empleados, asociados, salarios, bajas, autorizaciones e historial interno.</p>
        </section>
        <form className="login-form" onSubmit={submit}>
          <h2>Entrar</h2>
          <label>
            Correo
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>
            Contrasena
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-btn full" disabled={busy}>
            <ShieldCheck size={18} /> {busy ? 'Validando...' : 'Entrar al sistema'}
          </button>
        </form>
      </div>
    </ShellFrame>
  );
}

function Dashboard({
  metrics,
  employeeRows,
  partners,
  requests,
  shifts,
  attendanceRecords,
  expenseReports,
  profile,
  onOpenEmployees,
  onOpenRequests
}) {
  const byPartner = partners.map((partner) => {
    const rows = employeeRows.filter((employee) => employee.partner_id === partner.id);
    return {
      partner,
      total: rows.length,
      active: rows.filter((employee) => employee.status === 'active').length,
      terminated: rows.filter((employee) => employee.status === 'terminated').length,
      salary: rows.reduce((sum, employee) => sum + Number(employee.compensation?.current_salary || 0), 0)
    };
  });
  const byStatus = Object.entries(STATUS_LABELS).map(([status, label]) => ({
    label,
    value: employeeRows.filter((employee) => employee.status === status).length,
    filter: { status }
  })).filter((item) => item.value > 0);
  const byDepartment = topCounts(employeeRows, 'department_name', 'Sin area', 7);
  const pendingExpenses = expenseReports.filter((report) => ['draft', 'pending', 'submitted'].includes(report.status)).length;

  return (
    <div className="content-stack">
      <section className="metric-grid">
        <Metric icon={<UsersRound />} label="Total empleados" value={metrics.total} onClick={() => onOpenEmployees({})} />
        <Metric icon={<Check />} label="Activos" value={metrics.active} onClick={() => onOpenEmployees({ status: 'active' })} />
        <Metric icon={<X />} label="Bajas" value={metrics.terminated} onClick={() => onOpenEmployees({ status: 'terminated' })} />
        <Metric icon={<Clock3 />} label="Pendientes" value={metrics.pending} onClick={onOpenRequests} />
        <Metric icon={<AlertTriangle />} label="Info incompleta" value={metrics.incomplete} onClick={() => onOpenEmployees({})} />
        <Metric icon={<FileClock />} label="Rotacion" value={`${metrics.rotation}%`} />
        <Metric icon={<BriefcaseBusiness />} label="Antigüedad promedio" value={`${metrics.averageSeniority.toFixed(1)} años`} />
        {can(profile, 'viewSalary') && <Metric icon={<CircleDollarSign />} label="Masa salarial" value={money(metrics.salaryTotal)} />}
      </section>

      <section className="chart-grid">
        <ChartPanel title="Empleados por estatus" subtitle="Distribucion actual del personal.">
          <DonutChart rows={byStatus} total={metrics.total} onPick={(item) => onOpenEmployees(item.filter)} />
        </ChartPanel>
        <ChartPanel title="Empleados por area" subtitle="Concentracion por departamento.">
          <BarChart rows={byDepartment} onPick={(item) => onOpenEmployees({ department: item.id })} />
        </ChartPanel>
        <ChartPanel title="Operacion RH" subtitle="Modulos preparados para control diario.">
          <div className="module-stats">
            <ModuleStat icon={<Clock3 />} label="Turnos" value={shifts.length} />
            <ModuleStat icon={<CalendarCheck />} label="Asistencia" value={attendanceRecords.length} />
            <ModuleStat icon={<ReceiptText />} label="Gastos abiertos" value={pendingExpenses} />
          </div>
        </ChartPanel>
      </section>

      <section className="split-layout">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Empleados por asociado</h2>
              <p>Resumen operativo por patron.</p>
            </div>
          </div>
          <div className="list-lines">
            {byPartner.length === 0 && <EmptyLine text="No hay asociados registrados." />}
            {byPartner.map((item) => (
              <button className="line-button" key={item.partner.id} onClick={() => onOpenEmployees({ partner_id: item.partner.id })}>
                <Building2 size={18} />
                <span>{item.partner.name}</span>
                <strong>{item.total}</strong>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Solicitudes recientes</h2>
              <p>Acciones sensibles bajo autorizacion.</p>
            </div>
          </div>
          <div className="list-lines">
            {requests.slice(0, 6).length === 0 && <EmptyLine text="No hay solicitudes todavia." />}
            {requests.slice(0, 6).map((request) => (
              <button className="line-button" key={request.id} onClick={onOpenRequests}>
                <ShieldCheck size={18} />
                <span>{AUTH_LABELS[request.type]}</span>
                <StatusBadge status={request.status} />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function EmployeesView(props) {
  const {
    profile,
    employees,
    partners,
    filters,
    departments,
    positions,
    payRates,
    displayMode,
    query,
    onQuery,
    onFilters,
    onDisplayMode,
    onCreate,
    onEdit,
    onSensitive,
    onClearFilters
  } = props;
  const [tableCollapsed, setTableCollapsed] = useState(false);
  const filteredPositions = filters.department
    ? positions.filter((position) => position.department_id === filters.department)
    : positions;

  return (
    <div className="content-stack">
      <section className="toolbar">
        <div className="search-box">
          <Search size={18} />
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Buscar empleado, CURP, RFC, puesto..." />
        </div>
        <div className="toolbar-actions">
          <button className="ghost-btn" onClick={() => setTableCollapsed((value) => !value)}>
            <Table2 size={18} /> {tableCollapsed ? 'Abrir tabla' : 'Cerrar tabla'}
          </button>
          <button className={`icon-toggle ${displayMode === 'table' ? 'active' : ''}`} title="Vista tabla" onClick={() => onDisplayMode('table')}><Table2 size={18} /></button>
          <button className={`icon-toggle ${displayMode === 'cards' ? 'active' : ''}`} title="Vista tarjetas" onClick={() => onDisplayMode('cards')}><Grid2X2 size={18} /></button>
          {can(profile, 'manageEmployees') && <button className="primary-btn" onClick={onCreate}><Plus size={18} /> Alta empleado</button>}
        </div>
      </section>

      <section className="filter-bar">
        <ListFilter size={18} />
        <select value={filters.status} onChange={(event) => onFilters({ ...filters, status: event.target.value })}>
          <option value="">Todos los estatus</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={filters.partner_id} onChange={(event) => onFilters({ ...filters, partner_id: event.target.value })}>
          <option value="">Todos los asociados</option>
          {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
        </select>
        <select value={filters.department} onChange={(event) => onFilters({ ...filters, department: event.target.value })}>
          <option value="">Todas las áreas</option>
          {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select value={filters.position} onChange={(event) => onFilters({ ...filters, position: event.target.value })}>
          <option value="">Todos los puestos</option>
          {filteredPositions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <span className="filter-hint">{payRates.length} tarifas configuradas</span>
        <button className="ghost-btn compact" onClick={onClearFilters}>Limpiar</button>
      </section>

      {displayMode === 'table' && !tableCollapsed ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Estatus</th>
                <th>Asociado</th>
                <th>Puesto</th>
                <th>Area</th>
                <th>Ingreso</th>
                {can(profile, 'viewSalary') && <th>Salario</th>}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <EmployeeRow
                  key={employee.id}
                  employee={employee}
                  profile={profile}
                  onEdit={onEdit}
                  onSensitive={onSensitive}
                />
              ))}
            </tbody>
          </table>
          {employees.length === 0 && <div className="empty-state">No hay empleados con esos filtros.</div>}
        </div>
      ) : displayMode === 'table' ? (
        <div className="empty-state compact">Tabla cerrada. Usa "Abrir tabla" para verla de nuevo.</div>
      ) : (
        <div className="card-grid">
          {employees.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              profile={profile}
              onEdit={onEdit}
              onSensitive={onSensitive}
            />
          ))}
          {employees.length === 0 && <div className="empty-state">No hay empleados con esos filtros.</div>}
        </div>
      )}
    </div>
  );
}

function EmployeeRow({ employee, profile, onEdit, onSensitive }) {
  return (
    <tr>
      <td>{employee.employee_code}</td>
      <td>
        <strong>{employee.full_name}</strong>
        <small>{employee.rfc || 'RFC pendiente'}</small>
      </td>
      <td><EmployeeStatus status={employee.status} /></td>
      <td>{employee.partner?.name || 'Sin asociado'}</td>
      <td>{employee.position_name || 'Sin puesto'}</td>
      <td>{employee.department_name || 'Sin área'}</td>
      <td>{shortDate(employee.hire_date)}</td>
      {can(profile, 'viewSalary') && <td>{money(employee.compensation?.current_salary)}</td>}
      <td>
        <ActionStrip employee={employee} profile={profile} onEdit={onEdit} onSensitive={onSensitive} />
      </td>
    </tr>
  );
}

function EmployeeCard({ employee, profile, onEdit, onSensitive }) {
  return (
    <article className="employee-card">
      <div className="employee-card-top">
        <div>
          <strong>{employee.full_name}</strong>
          <span>{employee.employee_code}</span>
        </div>
        <EmployeeStatus status={employee.status} />
      </div>
      <dl>
        <div><dt>Asociado</dt><dd>{employee.partner?.name || 'Sin asociado'}</dd></div>
        <div><dt>Puesto</dt><dd>{employee.position_name || 'Sin puesto'}</dd></div>
        <div><dt>Área</dt><dd>{employee.department_name || 'Sin área'}</dd></div>
        <div><dt>Ingreso</dt><dd>{shortDate(employee.hire_date)}</dd></div>
        {can(profile, 'viewSalary') && <div><dt>Salario</dt><dd>{money(employee.compensation?.current_salary)}</dd></div>}
      </dl>
      <ActionStrip employee={employee} profile={profile} onEdit={onEdit} onSensitive={onSensitive} />
    </article>
  );
}

function ActionStrip({ employee, profile, onEdit, onSensitive }) {
  return (
    <div className="action-strip">
      {can(profile, 'manageEmployees') && <button className="mini-btn" onClick={() => onEdit(employee)}>Editar</button>}
      {can(profile, 'requestSalary') && <button className="mini-btn" onClick={() => onSensitive('salary_change', employee)}>Salario</button>}
      {can(profile, 'requestPartnerChange') && <button className="mini-btn" onClick={() => onSensitive('partner_change', employee)}>Asociado</button>}
      {employee.status !== 'terminated' && can(profile, 'requestTermination') && <button className="mini-btn danger" onClick={() => onSensitive('termination', employee)}>Baja</button>}
      {employee.status === 'terminated' && can(profile, 'requestRehire') && <button className="mini-btn" onClick={() => onSensitive('rehire', employee)}>Reingreso</button>}
    </div>
  );
}

function PartnersView({ profile, partners, employees, onCreate, onEdit }) {
  return (
    <div className="content-stack">
      <section className="toolbar">
        <div>
          <h2>Asociados / patrones</h2>
          <p>Relacion laboral usada para filtrar dashboard y empleados.</p>
        </div>
        {can(profile, 'managePartners') && <button className="primary-btn" onClick={onCreate}><Plus size={18} /> Alta asociado</button>}
      </section>

      <div className="partner-grid">
        {partners.map((partner) => {
          const rows = employees.filter((employee) => employee.partner_id === partner.id);
          const salary = rows.reduce((sum, employee) => sum + Number(employee.compensation?.current_salary || 0), 0);
          return (
            <article className="partner-card" key={partner.id}>
              <div className="partner-top">
                <Building2 size={22} />
                <div>
                  <strong>{partner.name}</strong>
                  <span>{partner.rfc || 'RFC pendiente'}</span>
                </div>
                {can(profile, 'managePartners') && <button className="mini-btn" onClick={() => onEdit(partner)}>Editar</button>}
              </div>
              <div className="partner-stats">
                <span>{rows.length} empleados</span>
                <span>{rows.filter((employee) => employee.status === 'active').length} activos</span>
                {can(profile, 'viewSalary') && <span>{money(salary)}</span>}
              </div>
            </article>
          );
        })}
        {partners.length === 0 && <div className="empty-state">No hay asociados registrados.</div>}
      </div>
    </div>
  );
}

function AuthorizationsView({ profile, requests, employees, onApprove, onReject }) {
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

  return (
    <div className="content-stack">
      <div className="request-list">
        {requests.map((request) => {
          const employee = employeeById.get(request.employee_id);
          const canApprove = request.status === 'pending'
            && ((request.type === 'salary_change' && can(profile, 'approveSalary'))
              || (request.type !== 'salary_change' && can(profile, 'approveEmployee')));

          return (
            <article className="request-card" key={request.id}>
              <div className="request-main">
                <ShieldCheck size={22} />
                <div>
                  <strong>{AUTH_LABELS[request.type]}</strong>
                  <span>{employee?.full_name || 'Empleado'} · {shortDate(request.requested_at)}</span>
                  <p>{request.reason}</p>
                </div>
              </div>
              <div className="request-side">
                <StatusBadge status={request.status} />
                {canApprove && (
                  <div className="action-strip">
                    <button className="mini-btn approve" onClick={() => onApprove(request)}>Aprobar</button>
                    <button className="mini-btn danger" onClick={() => onReject(request)}>Rechazar</button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
        {requests.length === 0 && <div className="empty-state">No hay solicitudes registradas.</div>}
      </div>
    </div>
  );
}

function HistoryView({ history, employees }) {
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  return (
    <div className="history-list">
      {history.map((item) => {
        const employee = employeeById.get(item.employee_id);
        return (
          <article className="history-item" key={item.id}>
            <FileClock size={18} />
            <div>
              <strong>{historyLabel(item.action)}</strong>
              <span>{employee?.full_name || 'Empleado'} · {shortDate(item.created_at)}</span>
              {item.comment && <p>{item.comment}</p>}
            </div>
          </article>
        );
      })}
      {history.length === 0 && <div className="empty-state">El historial aparecera cuando se creen empleados o solicitudes.</div>}
    </div>
  );
}

function UsersAdminView({ users, currentUserId, onSave }) {
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    setDrafts(Object.fromEntries(users.map((user) => [
      user.auth_user_id,
      {
        full_name: user.full_name || nameFromEmail(user.email),
        role: user.role || 'read_only',
        is_active: user.is_active ?? false
      }
    ])));
  }, [users]);

  function updateDraft(userId, patch) {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        ...patch
      }
    }));
  }

  return (
    <div className="content-stack">
      <div className="toolbar">
        <div>
          <h2>Administracion de usuarios</h2>
          <p>Cambia roles, activa accesos y completa perfiles internos de RH.</p>
        </div>
      </div>

      <div className="table-wrap user-table">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Acceso</th>
              <th>Ultimo ingreso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const draft = drafts[user.auth_user_id] || {
                full_name: user.full_name || nameFromEmail(user.email),
                role: user.role || 'read_only',
                is_active: user.is_active ?? false
              };
              const hasProfile = Boolean(user.profile_id);
              return (
                <tr key={user.auth_user_id}>
                  <td>
                    <strong>{user.email}</strong>
                    <small>{hasProfile ? 'Perfil RH creado' : 'Perfil RH pendiente'}</small>
                  </td>
                  <td>
                    <input
                      value={draft.full_name}
                      onChange={(event) => updateDraft(user.auth_user_id, { full_name: event.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={draft.role}
                      onChange={(event) => updateDraft(user.auth_user_id, { role: event.target.value })}
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={draft.is_active ? 'true' : 'false'}
                      onChange={(event) => updateDraft(user.auth_user_id, { is_active: event.target.value === 'true' })}
                    >
                      <option value="true">Activo</option>
                      <option value="false">Bloqueado</option>
                    </select>
                  </td>
                  <td>{shortDate(user.last_sign_in_at || user.auth_created_at)}</td>
                  <td>
                    <button className="mini-btn approve" onClick={() => onSave(user, draft)}>
                      {user.auth_user_id === currentUserId ? 'Guardar mi perfil' : 'Guardar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {users.length === 0 && <div className="empty-state">No hay usuarios de Auth para mostrar.</div>}
    </div>
  );
}

function EmployeeForm({ mode, value, partners, departments, positions, payRates, onCancel, onSubmit }) {
  const [form, setForm] = useState(value);
  const isEdit = mode === 'edit';
  const selectedDepartmentId = form.department_id === '__new' ? '' : form.department_id;
  const filteredPositions = selectedDepartmentId
    ? positions.filter((position) => position.department_id === selectedDepartmentId)
    : [];
  const selectedRate = payRates.find((rate) => rate.id === form.pay_rate_id);

  function updatePayRate(payRateId) {
    const rate = payRates.find((item) => item.id === payRateId);
    setForm({
      ...form,
      pay_rate_id: payRateId,
      payment_type: rate?.payment_type || form.payment_type,
      vacation_days: rate?.vacation_days ?? form.vacation_days
    });
  }

  return (
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
      <h2>{isEdit ? 'Editar empleado' : 'Alta de empleado'}</h2>
      <div className="form-grid">
        {isEdit ? (
          <Input label="ID empleado" value={form.employee_code} disabled onChange={() => {}} />
        ) : (
          <div className="readonly-field">
            <span>ID empleado</span>
            <strong>Se genera automáticamente</strong>
          </div>
        )}
        <Input label="Nombre completo" value={form.full_name} required onChange={(value) => setForm({ ...form, full_name: value })} />
        <Input label="CURP" value={form.curp} maxLength={18} onChange={(value) => setForm({ ...form, curp: value.toUpperCase().slice(0, 18) })} />
        <Input label="RFC" value={form.rfc} maxLength={13} onChange={(value) => setForm({ ...form, rfc: value.toUpperCase().slice(0, 13) })} />
        <Input label="NSS" value={form.nss} maxLength={11} inputMode="numeric" onChange={(value) => setForm({ ...form, nss: onlyDigits(value).slice(0, 11) })} />
        <Input label="Correo" value={form.email} type="email" onChange={(value) => setForm({ ...form, email: value })} />
        <Input label="Teléfono" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
        <Input label="Teléfono alterno" value={form.secondary_phone} onChange={(value) => setForm({ ...form, secondary_phone: value })} />
        <label>
          Área / departamento
          <select value={form.department_id || ''} onChange={(event) => setForm({ ...form, department_id: event.target.value, position_id: '' })}>
            <option value="">Selecciona área</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            <option value="__new">Agregar nueva área</option>
          </select>
        </label>
        {form.department_id === '__new' && (
          <Input label="Nueva área" value={form.new_department_name} required onChange={(value) => setForm({ ...form, new_department_name: value })} />
        )}
        <label>
          Puesto
          <select value={form.position_id || ''} disabled={!form.department_id} onChange={(event) => setForm({ ...form, position_id: event.target.value })}>
            <option value="">Selecciona puesto</option>
            {filteredPositions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}
            <option value="__new">Agregar nuevo puesto</option>
          </select>
        </label>
        {form.position_id === '__new' && (
          <Input label="Nuevo puesto" value={form.new_position_name} required onChange={(value) => setForm({ ...form, new_position_name: value })} />
        )}
        <Input label="Fecha ingreso" value={form.hire_date || ''} type="date" onChange={(value) => setForm({ ...form, hire_date: value })} />
        <label>
          Asociado / patrón
          <select value={form.partner_id || ''} disabled={isEdit} onChange={(event) => setForm({ ...form, partner_id: event.target.value })}>
            <option value="">Sin asociado</option>
            {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
            {!isEdit && <option value="__new">Agregar nuevo asociado</option>}
          </select>
        </label>
        {form.partner_id === '__new' && (
          <>
            <Input label="Nuevo asociado" value={form.new_partner_name} required onChange={(value) => setForm({ ...form, new_partner_name: value })} />
            <Input label="RFC asociado" value={form.new_partner_rfc} maxLength={13} onChange={(value) => setForm({ ...form, new_partner_rfc: value.toUpperCase().slice(0, 13) })} />
          </>
        )}
        <label>
          Tarifa / tipo de pago
          <select value={form.pay_rate_id || ''} onChange={(event) => updatePayRate(event.target.value)}>
            <option value="">Sin tarifa</option>
            {payRates.map((rate) => <option key={rate.id} value={rate.id}>{rate.name} · {money(rate.amount)} · {PAYMENT_LABELS[rate.payment_type]}</option>)}
            <option value="__new">Agregar nueva tarifa</option>
          </select>
        </label>
        {form.pay_rate_id === '__new' && (
          <>
            <Input label="Nombre de tarifa" value={form.new_pay_rate_name} required onChange={(value) => setForm({ ...form, new_pay_rate_name: value })} />
            <Input label="Monto de tarifa" type="number" value={form.new_pay_rate_amount} required onChange={(value) => setForm({ ...form, new_pay_rate_amount: value })} />
          </>
        )}
        <label>
          Tipo de pago
          <select value={form.payment_type} onChange={(event) => setForm({ ...form, payment_type: event.target.value })}>
            {Object.entries(PAYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <Input label="Vacaciones asignadas" type="number" value={form.vacation_days} onChange={(value) => setForm({ ...form, vacation_days: Number(value || 0) })} />
        {selectedRate && <p className="form-note inline-note">Tarifa seleccionada: {money(selectedRate.amount)} · {selectedRate.vacation_days} días de vacaciones.</p>}
        <Input label="Contacto de emergencia" value={form.emergency_contact_name} onChange={(value) => setForm({ ...form, emergency_contact_name: value })} />
        <Input label="Teléfono emergencia" value={form.emergency_contact_phone} onChange={(value) => setForm({ ...form, emergency_contact_phone: value })} />
        <Input label="Parentesco / relación" value={form.emergency_contact_relationship} onChange={(value) => setForm({ ...form, emergency_contact_relationship: value })} />
        <label className="wide">
          Dirección
          <textarea value={form.address || ''} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        </label>
        <label className="wide">
          Notas
          <textarea value={form.notes || ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
      </div>
      {isEdit && <p className="form-note">El cambio de asociado, salario, baja o reingreso se solicita desde las acciones del empleado.</p>}
      <FormActions onCancel={onCancel} submitLabel={isEdit ? 'Guardar cambios' : 'Crear empleado'} />
    </form>
  );
}

function PartnerForm({ mode, value, onCancel, onSubmit }) {
  const [form, setForm] = useState(value);
  const isEdit = mode === 'edit';
  return (
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
      <h2>{isEdit ? 'Editar asociado' : 'Alta de asociado'}</h2>
      <div className="form-grid">
        <Input label="Nombre comercial" value={form.name} required onChange={(value) => setForm({ ...form, name: value })} />
        <Input label="Razon social" value={form.legal_name || ''} onChange={(value) => setForm({ ...form, legal_name: value })} />
        <Input label="RFC" value={form.rfc || ''} onChange={(value) => setForm({ ...form, rfc: value })} />
        <Input label="Contacto" value={form.contact_name || ''} onChange={(value) => setForm({ ...form, contact_name: value })} />
        <Input label="Telefono" value={form.phone || ''} onChange={(value) => setForm({ ...form, phone: value })} />
        <label>
          Estatus
          <select value={String(form.is_active)} onChange={(event) => setForm({ ...form, is_active: event.target.value === 'true' })}>
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </label>
        <label className="wide">
          Notas
          <textarea value={form.notes || ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
      </div>
      <FormActions onCancel={onCancel} submitLabel={isEdit ? 'Guardar asociado' : 'Crear asociado'} />
    </form>
  );
}

function SensitiveForm({ type, employee, value, partners, onCancel, onSubmit }) {
  const [form, setForm] = useState(value);
  return (
    <form className="modal-form narrow" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
      <h2>{AUTH_LABELS[type]}</h2>
      <p className="form-note">{employee.full_name}</p>
      {type === 'salary_change' && <Input label="Nuevo salario" type="number" value={form.new_salary} required onChange={(next) => setForm({ ...form, new_salary: next })} />}
      {type === 'termination' && <Input label="Fecha de baja" type="date" value={form.termination_date} required onChange={(next) => setForm({ ...form, termination_date: next })} />}
      {type === 'rehire' && <Input label="Fecha de reingreso" type="date" value={form.hire_date} required onChange={(next) => setForm({ ...form, hire_date: next })} />}
      {type === 'partner_change' && (
        <label>
          Nuevo asociado
          <select value={form.partner_id} required onChange={(event) => setForm({ ...form, partner_id: event.target.value })}>
            <option value="">Selecciona asociado</option>
            {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
          </select>
        </label>
      )}
      <label>
        Motivo
        <textarea value={form.reason} required onChange={(event) => setForm({ ...form, reason: event.target.value })} />
      </label>
      <FormActions onCancel={onCancel} submitLabel="Crear solicitud" />
    </form>
  );
}

function RejectForm({ request, value, onCancel, onSubmit }) {
  const [form, setForm] = useState(value);
  return (
    <form className="modal-form narrow" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
      <h2>Rechazar solicitud</h2>
      <p className="form-note">{AUTH_LABELS[request.type]}</p>
      <label>
        Motivo del rechazo
        <textarea value={form.rejection_reason} required onChange={(event) => setForm({ rejection_reason: event.target.value })} />
      </label>
      <FormActions onCancel={onCancel} submitLabel="Rechazar" danger />
    </form>
  );
}

function Input({ label, value, onChange, type = 'text', required = false, maxLength, disabled = false, inputMode }) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value || ''}
        required={required}
        maxLength={maxLength}
        disabled={disabled}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function FormActions({ onCancel, submitLabel, danger }) {
  return (
    <div className="form-actions">
      <button type="button" className="ghost-btn" onClick={onCancel}>Cancelar</button>
      <button className={`primary-btn ${danger ? 'danger-bg' : ''}`} type="submit">{submitLabel}</button>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel">
        <button className="modal-close" title="Cerrar" onClick={onClose}><X size={20} /></button>
        {children}
      </div>
    </div>
  );
}

function Metric({ icon, label, value, onClick }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp className="metric" onClick={onClick}>
      <span className="metric-icon">{React.cloneElement(icon, { size: 21, strokeWidth: 2.2 })}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </Comp>
  );
}

function ChartPanel({ title, subtitle, children }) {
  return (
    <div className="panel chart-panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function DonutChart({ rows, total, onPick }) {
  const safeTotal = Math.max(total, 1);
  return (
    <div className="donut-layout">
      <div className="donut-ring" style={{ '--pct': `${Math.round(((rows[0]?.value || 0) / safeTotal) * 100)}%` }}>
        <strong>{total}</strong>
        <span>Total</span>
      </div>
      <div className="chart-list">
        {rows.length === 0 && <EmptyLine text="Sin datos para graficar." />}
        {rows.map((item) => (
          <button className="chart-row" key={item.label} onClick={() => onPick?.(item)}>
            <span>{item.label}</span>
            <div><i style={{ width: `${Math.max(6, (item.value / safeTotal) * 100)}%` }} /></div>
            <strong>{item.value}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function BarChart({ rows, onPick }) {
  const max = Math.max(...rows.map((item) => item.value), 1);
  return (
    <div className="chart-list">
      {rows.length === 0 && <EmptyLine text="Sin datos para graficar." />}
      {rows.map((item) => (
        <button className="chart-row" key={item.label} onClick={() => onPick?.(item)}>
          <span>{item.label}</span>
          <div><i style={{ width: `${Math.max(6, (item.value / max) * 100)}%` }} /></div>
          <strong>{item.value}</strong>
        </button>
      ))}
    </div>
  );
}

function ModuleStat({ icon, label, value }) {
  return (
    <div className="module-stat">
      <span>{React.cloneElement(icon, { size: 20 })}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}

function NavButton({ active, icon, label, onClick }) {
  return (
    <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="nav-icon">{React.cloneElement(icon, { size: 18, strokeWidth: 2.15 })}</span><span>{label}</span>
    </button>
  );
}

function EmployeeStatus({ status }) {
  return <span className={`employee-status ${status}`}>{STATUS_LABELS[status] || status}</span>;
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${status}`}>{AUTH_STATUS_LABELS[status] || status}</span>;
}

function ShellFrame({ children }) {
  return <div className="shell-frame">{children}</div>;
}

function EmptyLine({ text }) {
  return <div className="empty-line">{text}</div>;
}

function titleFor(view) {
  return {
    dashboard: 'Dashboard',
    employees: 'Empleados',
    partners: 'Asociados / patrones',
    authorizations: 'Autorizaciones',
    history: 'Historial',
    users: 'Usuarios'
  }[view];
}

function nameFromEmail(email) {
  return String(email || 'Usuario').split('@')[0].replace(/[._-]+/g, ' ');
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function topCounts(rows, key, emptyLabel, limit = 6) {
  const counts = new Map();
  const ids = new Map();
  rows.forEach((row) => {
    const label = row[key] || emptyLabel;
    counts.set(label, (counts.get(label) || 0) + 1);
    if (row.department_id && key === 'department_name') ids.set(label, row.department_id);
    if (row.position_id && key === 'position_name') ids.set(label, row.position_id);
  });
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value, id: ids.get(label) || '' }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function clean(value) {
  const next = String(value || '').trim();
  return next || null;
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function validateEmployeeForm(value) {
  const curp = clean(value.curp);
  const rfc = clean(value.rfc);
  const nss = clean(value.nss);
  if (curp && curp.length !== 18) throw new Error('CURP debe tener exactamente 18 caracteres.');
  if (rfc && ![12, 13].includes(rfc.length)) throw new Error('RFC debe tener 12 caracteres para persona moral o 13 para persona física.');
  if (nss && !/^\d{11}$/.test(nss)) throw new Error('NSS debe tener exactamente 11 dígitos.');
  if (value.department_id === '__new' && !clean(value.new_department_name)) throw new Error('Escribe el nombre de la nueva área.');
  if (value.position_id === '__new' && !clean(value.new_position_name)) throw new Error('Escribe el nombre del nuevo puesto.');
  if (value.partner_id === '__new' && !clean(value.new_partner_name)) throw new Error('Escribe el nombre del nuevo asociado/patrón.');
  if (value.pay_rate_id === '__new' && !clean(value.new_pay_rate_name)) throw new Error('Escribe el nombre de la nueva tarifa.');
}

function normalizeEmployee(value, userId, mode) {
  const payload = {
    full_name: value.full_name.trim(),
    curp: clean(value.curp),
    rfc: clean(value.rfc),
    nss: clean(value.nss),
    email: clean(value.email),
    phone: clean(value.phone),
    secondary_phone: clean(value.secondary_phone),
    address: clean(value.address),
    department_id: value.department_id || null,
    position_id: value.position_id || null,
    pay_rate_id: value.pay_rate_id || null,
    position: null,
    department: null,
    hire_date: value.hire_date || null,
    partner_id: value.partner_id || null,
    payment_type: value.payment_type || 'monthly',
    vacation_days: Number(value.vacation_days || 0),
    emergency_contact_name: clean(value.emergency_contact_name),
    emergency_contact_phone: clean(value.emergency_contact_phone),
    emergency_contact_relationship: clean(value.emergency_contact_relationship),
    notes: clean(value.notes),
    updated_by: userId,
    ...(mode === 'create' ? { created_by: userId } : {})
  };

  if (mode === 'edit') payload.employee_code = value.employee_code.trim();
  return payload;
}

function mapEmployeeToForm(employee) {
  return {
    id: employee.id,
    employee_code: employee.employee_code || '',
    full_name: employee.full_name || '',
    curp: employee.curp || '',
    rfc: employee.rfc || '',
    nss: employee.nss || '',
    email: employee.email || '',
    phone: employee.phone || '',
    secondary_phone: employee.secondary_phone || '',
    address: employee.address || '',
    department_id: employee.department_id || '',
    position_id: employee.position_id || '',
    pay_rate_id: employee.pay_rate_id || '',
    position: employee.position || '',
    department: employee.department || '',
    hire_date: employee.hire_date || '',
    partner_id: employee.partner_id || '',
    new_partner_name: '',
    new_partner_rfc: '',
    new_department_name: '',
    new_position_name: '',
    new_pay_rate_name: '',
    new_pay_rate_amount: '',
    vacation_days: employee.vacation_days ?? 12,
    payment_type: employee.payment_type || 'monthly',
    emergency_contact_name: employee.emergency_contact_name || '',
    emergency_contact_phone: employee.emergency_contact_phone || '',
    emergency_contact_relationship: employee.emergency_contact_relationship || '',
    notes: employee.notes || ''
  };
}

function sensitiveDefaults(type, employee) {
  const today = new Date().toISOString().slice(0, 10);
  if (type === 'salary_change') return { new_salary: employee.compensation?.current_salary || '', reason: '' };
  if (type === 'termination') return { termination_date: today, reason: '' };
  if (type === 'rehire') return { hire_date: today, reason: '' };
  if (type === 'partner_change') return { partner_id: '', reason: '' };
  return { reason: '' };
}

function historyLabel(action) {
  const labels = {
    created: 'Empleado creado',
    updated: 'Empleado actualizado',
    salary_change_approved: 'Cambio salarial aprobado',
    termination_approved: 'Baja aprobada',
    rehire_approved: 'Reingreso aprobado',
    partner_change_approved: 'Cambio de asociado aprobado',
    salary_change_rejected: 'Cambio salarial rechazado',
    termination_rejected: 'Baja rechazada',
    rehire_rejected: 'Reingreso rechazado',
    partner_change_rejected: 'Cambio de asociado rechazado'
  };
  return labels[action] || action;
}

createRoot(document.getElementById('root')).render(<App />);
