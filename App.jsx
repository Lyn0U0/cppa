import React, { useState } from 'react';
import { 
  Layout, Menu, Table, Button, Modal, Form, Input, Select, 
  InputNumber, Switch, Space, Tag, message, Row, Col,
  DatePicker, Radio, Divider, Transfer, Checkbox, TimePicker, Card, Tabs, Drawer, Alert
} from 'antd';
import { 
  PlusOutlined, EditOutlined, 
  ThunderboltOutlined, TeamOutlined, FileTextOutlined, 
  MoneyCollectOutlined, SettingOutlined, UnorderedListOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { Option } = Select;
const { RangePicker } = DatePicker;

// ============================================================================
// 初始 Mock Data 
// ============================================================================
const initialPlantData = [
  { id: '1', plant_code: 'PLT-S-001', plant_name: '彰濱一期太陽能廠', plant_type: 'solar', owner_type: 'owned', installed_capacity_kw: 1500, city: '彰化縣', district: '鹿港鎮', location_desc: '彰濱工業區', latitude: 24.068333, longitude: 120.404444, remark: '一期擴建工程已完工', is_active: true },
  { id: '2', plant_code: 'PLT-W-001', plant_name: '苗栗離岸風電示範區', plant_type: 'wind', owner_type: 'purchased', installed_capacity_kw: 8000, city: '苗栗縣', district: '竹南鎮', location_desc: '苗栗外海', latitude: 24.683333, longitude: 120.866667, remark: '示範風場', is_active: true },
];

const initialClientData = [
  { id: '1', customer_code: 'CUST-G-001', customer_name: '台灣護國半導體', industry_type: '半導體製造業', customer_type: 'group', contact_name: '陳大文', contact_email: 'dawen.chen@example.com', contact_phone: '02-2345-6789', remark: 'VIP', is_active: true },
  { id: '2', customer_code: 'CUST-E-001', customer_name: '雲端科技台灣', industry_type: '資訊軟體業', customer_type: 'enterprise', contact_name: '林小雅', contact_email: 'xiaoya.lin@example.com', contact_phone: '02-8765-4321', remark: '', is_active: true },
];

const initialMeterData = [
  { id: '1', meter_code: 'MTR-001', meter_name: '竹科一廠主電表', customer_id: '1', voltage_type: 'extra_high', city: '新竹市', district: '東區', location_desc: '展業一路', remark: '', is_active: true },
  { id: '2', meter_code: 'MTR-002', meter_name: '內湖大樓總表', customer_id: '2', voltage_type: 'high', city: '台北市', district: '內湖區', location_desc: '瑞光路', remark: '', is_active: true },
];

const initialContractData = [
  { id: '1', contract_code: 'CPPA-2024-001', contract_name: '台積電購售電合約', contract_type: 'TAKE_AND_PAY', plant_id: '1', customer_id: '1', tariff_plan_id: '1', contract_price: 4.5, contract_start_at: '2024-01-01', contract_end_at: '2034-12-31', base_supply_ratio: 80, min_supply_ratio: 70, max_supply_ratio: 100, guaranteed_energy_kwh: 5000000, remark: '首批合約', contract_state: 'ACTIVE' },
  { id: '2', contract_code: 'CPPA-2024-002', contract_name: '雲端科技綠電轉供', contract_type: 'TAKE_OR_PAY', plant_id: '2', customer_id: '2', tariff_plan_id: '2', contract_price: 5.2, contract_start_at: '2024-06-01', contract_end_at: '2029-05-31', base_supply_ratio: 100, min_supply_ratio: 90, max_supply_ratio: 100, guaranteed_energy_kwh: null, remark: '', contract_state: 'DRAFT' },
];

const initialPricingPolicyData = [
  { id: '1', plan_code: 'POL-HV-001', plan_name: '高壓三段式時間電價', voltage_type: 'HIGH_VOLTAGE', plan_source: '台電公告', description: '高壓用戶適用', remark: '', is_active: true },
  { id: '2', plan_code: 'POL-EHV-001', plan_name: '特高壓三段式', voltage_type: 'EXTRA_HIGH_VOLTAGE', plan_source: '台電公告', description: '大型企業適用', remark: '', is_active: true },
];

const initialPeriodData = [
  { id: '1', version_code: 'PRD-SUMMER', version_name: '2024夏月時段', tariff_plan_id: '1', version_type: 'SUMMER', effective_start_date: '2024-06-01', effective_end_date: '2024-09-30', remark: '', is_active: true },
];

const initialPeriodDetailData = [
  { id: '1', tariff_period_version_id: '1', period_code: 'DTL-PEAK', period_name: '尖峰時段', period_type: 'PEAK', start_time: '09:00', end_time: '17:00', energy_price: 4.8, is_weekday: true, is_saturday: false, is_holiday: false, description: '日間尖峰', remark: '', is_active: true },
];


// ============================================================================
// 樞紐 1: 發電案場管理 (Plant Hub)
// ============================================================================
const PlantHub = () => {
  const [data, setData] = useState(initialPlantData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const handleEdit = (r) => { setEditing(r); form.setFieldsValue(r); setIsModalOpen(true); };
  const handleAdd = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ is_active: true }); setIsModalOpen(true); };

  const onSave = () => {
    form.validateFields().then(values => {
      if (editing) setData(data.map(i => i.id === editing.id ? { ...i, ...values } : i));
      else setData([...data, { ...values, id: Date.now().toString() }]);
      setIsModalOpen(false);
      message.success('案場資料已儲存');
    });
  };

  const columns = [
    { title: '案場代碼', dataIndex: 'plant_code' },
    { title: '名稱', dataIndex: 'plant_name' },
    { title: '類型', dataIndex: 'plant_type', render: t => <Tag color={t==='solar'?'orange':'blue'}>{t==='solar'?'太陽能':'風力'}</Tag> },
    { title: '容量(kW)', dataIndex: 'installed_capacity_kw', align: 'right', render: v => v?.toLocaleString() },
    { title: '狀態', dataIndex: 'is_active', render: a => <Tag color={a?'green':'red'}>{a?'啟用':'停用'}</Tag> },
    { title: '操作', render: (_, r) => <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(r)}>編輯</Button> }
  ];

  return (
    <Card title="發電案場管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增案場</Button>}>
      <Table columns={columns} dataSource={data} rowKey="id" pagination={{ pageSize: 8 }} />
      <Modal title={editing ? "編輯案場" : "新增案場"} open={isModalOpen} onOk={onSave} onCancel={() => setIsModalOpen(false)} width={700} destroyOnClose>
        <Form form={form} layout="vertical">
          <Divider orientation="left">基本資訊</Divider>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="plant_code" label="案場代碼" rules={[{required: true}]}><Input/></Form.Item></Col>
            <Col span={12}><Form.Item name="plant_name" label="案場名稱" rules={[{required: true}]}><Input/></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="plant_type" label="發電類型" rules={[{required: true}]}><Select><Option value="solar">太陽能</Option><Option value="wind">風力</Option></Select></Form.Item></Col>
            <Col span={8}><Form.Item name="owner_type" label="來源屬性" rules={[{required: true}]}><Select><Option value="owned">自有</Option><Option value="purchased">外購</Option></Select></Form.Item></Col>
            <Col span={8}><Form.Item name="installed_capacity_kw" label="裝置容量(kW)" rules={[{required: true}]}><InputNumber style={{width:'100%'}} min={0.1}/></Form.Item></Col>
          </Row>
          <Divider orientation="left">地理資訊</Divider>
          <Row gutter={16}>
            <Col span={6}><Form.Item name="city" label="縣市"><Input/></Form.Item></Col>
            <Col span={6}><Form.Item name="district" label="行政區"><Input/></Form.Item></Col>
            <Col span={6}><Form.Item name="latitude" label="緯度"><InputNumber style={{width:'100%'}} precision={6}/></Form.Item></Col>
            <Col span={6}><Form.Item name="longitude" label="經度"><InputNumber style={{width:'100%'}} precision={6}/></Form.Item></Col>
          </Row>
          <Form.Item name="remark" label="備註"><Input.TextArea rows={2}/></Form.Item>
          <Form.Item name="is_active" label="是否啟用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

// ============================================================================
// 樞紐 2: 客戶與電號管理 (Client Hub)
// ============================================================================
const ClientHub = () => {
  const [clientData, setClientData] = useState(initialClientData);
  const [meterData, setMeterData] = useState(initialMeterData);
  
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  
  const [isMeterModalOpen, setIsMeterModalOpen] = useState(false);
  const [editingMeter, setEditingMeter] = useState(null);

  const [clientForm] = Form.useForm();
  const [meterForm] = Form.useForm();

  // 客戶操作
  const handleEditClient = (r) => { setEditingClient(r); clientForm.setFieldsValue(r); setIsClientModalOpen(true); };
  const onSaveClient = () => {
    clientForm.validateFields().then(values => {
      if (editingClient) setClientData(clientData.map(i => i.id === editingClient.id ? { ...i, ...values } : i));
      else setClientData([...clientData, { ...values, id: Date.now().toString() }]);
      setIsClientModalOpen(false);
      message.success('客戶資料已儲存');
    });
  };

  // 電號操作
  const handleAddMeter = () => {
    setEditingMeter(null);
    meterForm.resetFields();
    meterForm.setFieldsValue({ customer_id: editingClient.id, is_active: true });
    setIsMeterModalOpen(true);
  };
  const handleEditMeter = (r) => { setEditingMeter(r); meterForm.setFieldsValue(r); setIsMeterModalOpen(true); };
  const onSaveMeter = () => {
    meterForm.validateFields().then(values => {
      if (editingMeter) setMeterData(meterData.map(i => i.id === editingMeter.id ? { ...i, ...values } : i));
      else setMeterData([...meterData, { ...values, id: Date.now().toString() }]);
      setIsMeterModalOpen(false);
      message.success('電號資料已儲存');
    });
  };

  const clientColumns = [
    { title: '客戶代碼', dataIndex: 'customer_code' },
    { title: '名稱', dataIndex: 'customer_name' },
    { title: '客戶類型', dataIndex: 'customer_type', render: t => <Tag color="blue">{t}</Tag> },
    { title: '聯絡人', dataIndex: 'contact_name' },
    { title: '狀態', dataIndex: 'is_active', render: a => <Tag color={a?'green':'red'}>{a?'啟用':'停用'}</Tag> },
    { title: '操作', render: (_, r) => <Button type="link" icon={<EditOutlined />} onClick={() => handleEditClient(r)}>管理詳情</Button> }
  ];

  const meterColumns = [
    { title: '電號代碼', dataIndex: 'meter_code' },
    { title: '名稱', dataIndex: 'meter_name' },
    { title: '電壓類型', dataIndex: 'voltage_type', render: t => <Tag color="orange">{t}</Tag> },
    { title: '狀態', dataIndex: 'is_active', render: a => <Tag color={a?'green':'red'}>{a?'啟用':'停用'}</Tag> },
    { title: '操作', render: (_, r) => <Button type="link" size="small" onClick={() => handleEditMeter(r)}>編輯</Button> }
  ];

  // 客戶基本資料表單
  const ClientFormContent = (
    <Form form={clientForm} layout="vertical">
      <Row gutter={16}>
        <Col span={12}><Form.Item name="customer_code" label="客戶代碼" rules={[{required: true}]}><Input/></Form.Item></Col>
        <Col span={12}><Form.Item name="customer_name" label="客戶名稱" rules={[{required: true}]}><Input/></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}><Form.Item name="customer_type" label="客戶類型" rules={[{required: true}]}><Select><Option value="group">集團</Option><Option value="enterprise">企業</Option></Select></Form.Item></Col>
        <Col span={12}><Form.Item name="industry_type" label="產業別"><Input/></Form.Item></Col>
      </Row>
      <Divider orientation="left">聯絡人資訊</Divider>
      <Row gutter={16}>
        <Col span={8}><Form.Item name="contact_name" label="聯絡人"><Input/></Form.Item></Col>
        <Col span={8}><Form.Item name="contact_phone" label="電話"><Input/></Form.Item></Col>
        <Col span={8}><Form.Item name="contact_email" label="信箱" rules={[{type:'email'}]}><Input/></Form.Item></Col>
      </Row>
      <Form.Item name="remark" label="備註"><Input.TextArea rows={2}/></Form.Item>
      <Form.Item name="is_active" label="啟用狀態" valuePropName="checked"><Switch /></Form.Item>
    </Form>
  );

  return (
    <Card title="客戶與電號管理" extra={<Button type="primary" onClick={() => { setEditingClient(null); clientForm.resetFields(); setIsClientModalOpen(true); }}>新增客戶</Button>}>
      <Table columns={clientColumns} dataSource={clientData} rowKey="id" />
      
      {/* 整合式客戶詳情 Modal */}
      <Modal 
        title={editingClient ? `管理客戶 - ${editingClient.customer_name}` : "新增客戶"} 
        open={isClientModalOpen} onOk={onSaveClient} onCancel={() => setIsClientModalOpen(false)} 
        width={800} destroyOnClose
      >
        <Tabs defaultActiveKey="info" items={[
          { key: 'info', label: '客戶基本資料', children: <div style={{paddingTop: 16}}>{ClientFormContent}</div> },
          { 
            key: 'meters', 
            label: '旗下電號管理', 
            disabled: !editingClient, // 新增客戶時先不給加電號
            children: (
              <div style={{paddingTop: 16}}>
                <div style={{marginBottom: 16, textAlign: 'right'}}>
                  <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddMeter}>新增綁定電號</Button>
                </div>
                <Table 
                  size="small" 
                  columns={meterColumns} 
                  dataSource={meterData.filter(m => m.customer_id === editingClient?.id)} 
                  rowKey="id" 
                />
              </div>
            ) 
          }
        ]} />
      </Modal>

      {/* 專屬電號編輯 Modal */}
      <Modal title={editingMeter ? "編輯電號" : "新增電號"} open={isMeterModalOpen} onOk={onSaveMeter} onCancel={() => setIsMeterModalOpen(false)} destroyOnClose>
        <Form form={meterForm} layout="vertical">
          <Form.Item name="customer_id" hidden><Input /></Form.Item> {/* 隱藏綁定客戶 ID */}
          <Alert message={`此電號將綁定於：${editingClient?.customer_name}`} type="info" showIcon style={{marginBottom: 16}} />
          <Row gutter={16}>
            <Col span={12}><Form.Item name="meter_code" label="電號代碼" rules={[{required: true}]}><Input/></Form.Item></Col>
            <Col span={12}><Form.Item name="meter_name" label="電號名稱" rules={[{required: true}]}><Input/></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="voltage_type" label="電壓類型" rules={[{required: true}]}><Select><Option value="high">高壓</Option><Option value="extra_high">特高壓</Option></Select></Form.Item></Col>
            <Col span={12}><Form.Item name="city" label="縣市"><Input/></Form.Item></Col>
          </Row>
          <Form.Item name="location_desc" label="位置描述"><Input.TextArea rows={2}/></Form.Item>
          <Form.Item name="is_active" label="啟用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

// ============================================================================
// 樞紐 3: CPPA 合約管理 (Contract Hub)
// ============================================================================
const ContractHub = () => {
  const [data, setData] = useState(initialContractData);
  const [metersMap, setMetersMap] = useState({ '1': ['1', '2'] }); // 模擬關聯表
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  
  const currentStatus = Form.useWatch('contract_state', form);
  const isReadOnly = currentStatus && currentStatus !== 'DRAFT';

  // Transfer 元件使用的 local state
  const [targetMeters, setTargetMeters] = useState([]);

  const handleEdit = (r) => {
    setEditing(r);
    setTargetMeters(metersMap[r.id] || []); // 載入此合約綁定的電號
    form.setFieldsValue({
      ...r,
      dateRange: r.contract_start_at ? [dayjs(r.contract_start_at), dayjs(r.contract_end_at)] : null
    });
    setIsModalOpen(true);
  };

  const onSave = () => {
    form.validateFields().then(values => {
      const final = {
        ...values,
        contract_start_at: values.dateRange ? values.dateRange[0].format('YYYY-MM-DD') : null,
        contract_end_at: values.dateRange ? values.dateRange[1].format('YYYY-MM-DD') : null
      };
      delete final.dateRange;
      
      const newId = editing ? editing.id : Date.now().toString();
      
      if (editing) setData(data.map(i => i.id === editing.id ? { ...i, ...final } : i));
      else setData([...data, { ...final, id: newId }]);

      // 儲存關聯電號
      setMetersMap({ ...metersMap, [newId]: targetMeters });
      
      setIsModalOpen(false);
      message.success('合約設定已更新');
    });
  };

  const columns = [
    { title: '合約代碼', dataIndex: 'contract_code' },
    { title: '名稱', dataIndex: 'contract_name' },
    { title: '狀態', dataIndex: 'contract_state', render: s => <Tag color={s==='ACTIVE'?'green':s==='DRAFT'?'gray':'red'}>{s}</Tag> },
    { title: '綁定電號數', render: (_, r) => <Tag>{metersMap[r.id]?.length || 0}</Tag> },
    { title: '操作', render: (_, r) => <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(r)}>編輯設定</Button> }
  ];

  return (
    <Card title="CPPA 合約管理" extra={<Button type="primary" onClick={() => { setEditing(null); setTargetMeters([]); form.resetFields(); form.setFieldsValue({contract_state: 'DRAFT'}); setIsModalOpen(true); }}>新增合約</Button>}>
      <Table columns={columns} dataSource={data} rowKey="id" />
      
      <Modal title={editing ? "合約綜合設定" : "新增合約"} open={isModalOpen} onOk={onSave} onCancel={() => setIsModalOpen(false)} width={900} destroyOnClose>
        <Tabs defaultActiveKey="info" items={[
          {
            key: 'info',
            label: '合約基本資訊',
            children: (
              <Form form={form} layout="vertical" style={{paddingTop: 16}}>
                <Form.Item name="contract_state" label="合約狀態" rules={[{required: true}]}>
                  <Radio.Group buttonStyle="solid">
                    <Radio.Button value="DRAFT">草稿 (DRAFT)</Radio.Button>
                    <Radio.Button value="ACTIVE">生效 (ACTIVE)</Radio.Button>
                    <Radio.Button value="INACTIVE">停用 (INACTIVE)</Radio.Button>
                  </Radio.Group>
                </Form.Item>
                {isReadOnly && <Alert message="唯讀模式：非 DRAFT 狀態不可編輯合約內容與綁定電號。" type="warning" showIcon style={{marginBottom: 16}} />}
                
                <Row gutter={16}>
                  <Col span={12}><Form.Item name="contract_code" label="代碼" rules={[{required: true}]}><Input disabled={isReadOnly}/></Form.Item></Col>
                  <Col span={12}><Form.Item name="contract_name" label="名稱" rules={[{required: true}]}><Input disabled={isReadOnly}/></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}><Form.Item name="plant_id" label="案場" rules={[{required: true}]}><Select disabled={isReadOnly}>{initialPlantData.map(p => <Option key={p.id} value={p.id}>{p.plant_name}</Option>)}</Select></Form.Item></Col>
                  <Col span={8}><Form.Item name="customer_id" label="客戶" rules={[{required: true}]}><Select disabled={isReadOnly}>{initialClientData.map(c => <Option key={c.id} value={c.id}>{c.customer_name}</Option>)}</Select></Form.Item></Col>
                  <Col span={8}><Form.Item name="tariff_plan_id" label="電價制度" rules={[{required: true}]}><Select disabled={isReadOnly}>{initialPricingPolicyData.map(p => <Option key={p.id} value={p.id}>{p.plan_name}</Option>)}</Select></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}><Form.Item name="contract_price" label="電價(元)" rules={[{required: true}]}><InputNumber style={{width:'100%'}} disabled={isReadOnly}/></Form.Item></Col>
                  <Col span={16}><Form.Item name="dateRange" label="生效期間" rules={[{required: true}]}><RangePicker style={{width:'100%'}} disabled={isReadOnly}/></Form.Item></Col>
                </Row>
                <Form.Item name="guaranteed_energy_kwh" label="最低保證發電量(kWh)"><InputNumber style={{width:'100%'}} disabled={isReadOnly}/></Form.Item>
              </Form>
            )
          },
          {
            key: 'meters',
            label: '供電電號設定',
            children: (
              <div style={{paddingTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                {isReadOnly && <Alert message="非草稿（DRAFT）狀態之合約無法修改電號關聯設定。" type="error" showIcon style={{marginBottom: 16, width: '100%'}} />}
                <Transfer
                  dataSource={initialMeterData.map(m => ({ key: m.id, title: `${m.meter_code} - ${m.meter_name}` }))}
                  targetKeys={targetMeters}
                  onChange={keys => setTargetMeters(keys)}
                  render={i => i.title}
                  disabled={isReadOnly}
                  listStyle={{ width: 350, height: 400 }}
                  titles={['未綁定電號', '已綁定電號']}
                />
              </div>
            )
          }
        ]} />
      </Modal>
    </Card>
  );
};

// ============================================================================
// 樞紐 4: 電價制度管理 (Tariff Hub - 3層嵌套設計)
// ============================================================================
const PricingPolicyHub = () => {
  const [policyData, setPolicyData] = useState(initialPricingPolicyData);
  const [versionData, setVersionData] = useState(initialPeriodData);
  const [detailData, setDetailData] = useState(initialPeriodDetailData);

  // 第一層: Policy Modal
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [policyForm] = Form.useForm();

  // 第二層: Version Drawer & Modal
  const [isVersionDrawerOpen, setIsVersionDrawerOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState(null);
  const [versionForm] = Form.useForm();

  // 第三層: Detail Modal (這裡為求精簡，直接用 Modal 覆蓋在 Version Drawer 上)
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingDetail, setEditingDetail] = useState(null);
  const [detailForm] = Form.useForm();

  // --- Policy 操作 ---
  const handleEditPolicy = (r) => { setEditingPolicy(r); policyForm.setFieldsValue(r); setIsPolicyModalOpen(true); };
  const onSavePolicy = () => {
    policyForm.validateFields().then(values => {
      if (editingPolicy) setPolicyData(policyData.map(i => i.id === editingPolicy.id ? { ...i, ...values } : i));
      else setPolicyData([...policyData, { ...values, id: Date.now().toString() }]);
      setIsPolicyModalOpen(false);
    });
  };

  // --- Version 操作 ---
  const openVersionDrawer = (policy) => { setSelectedPolicy(policy); setIsVersionDrawerOpen(true); };
  const handleEditVersion = (r) => {
    setEditingVersion(r);
    versionForm.setFieldsValue({
      ...r,
      effective_start_date: r.effective_start_date ? dayjs(r.effective_start_date) : null,
      effective_end_date: r.effective_end_date ? dayjs(r.effective_end_date) : null
    });
    setIsVersionModalOpen(true);
  };
  const onSaveVersion = () => {
    versionForm.validateFields().then(values => {
      const final = { ...values, effective_start_date: values.effective_start_date.format('YYYY-MM-DD'), effective_end_date: values.effective_end_date ? values.effective_end_date.format('YYYY-MM-DD') : null };
      if (editingVersion) setVersionData(versionData.map(i => i.id === editingVersion.id ? { ...i, ...final } : i));
      else setVersionData([...versionData, { ...final, id: Date.now().toString() }]);
      setIsVersionModalOpen(false);
    });
  };

  // --- Detail 操作 ---
  const openDetailDrawer = (version) => { setSelectedVersion(version); setIsDetailDrawerOpen(true); };
  const handleEditDetail = (r) => {
    setEditingDetail(r);
    const days = [];
    if(r.is_weekday) days.push('weekday'); if(r.is_saturday) days.push('saturday'); if(r.is_holiday) days.push('holiday');
    detailForm.setFieldsValue({ ...r, timeRange: [dayjs(r.start_time, 'HH:mm'), dayjs(r.end_time, 'HH:mm')], days });
    setIsDetailModalOpen(true);
  };
  const onSaveDetail = () => {
    detailForm.validateFields().then(v => {
      const final = { ...v, start_time: v.timeRange[0].format('HH:mm'), end_time: v.timeRange[1].format('HH:mm'), is_weekday: v.days.includes('weekday'), is_saturday: v.days.includes('saturday'), is_holiday: v.days.includes('holiday') };
      delete final.timeRange; delete final.days;
      if (editingDetail) setDetailData(detailData.map(i => i.id === editingDetail.id ? { ...i, ...final } : i));
      else setDetailData([...detailData, { ...final, id: Date.now().toString() }]);
      setIsDetailModalOpen(false);
    });
  };

  return (
    <Card title="電價制度管理" extra={<Button type="primary" onClick={() => { setEditingPolicy(null); policyForm.resetFields(); setIsPolicyModalOpen(true); }}>新增制度</Button>}>
      {/* 第一層: 制度列表 */}
      <Table rowKey="id" dataSource={policyData} columns={[
        { title: '制度代碼', dataIndex: 'plan_code' },
        { title: '名稱', dataIndex: 'plan_name' },
        { title: '電壓類型', dataIndex: 'voltage_type', render: t => <Tag color="purple">{t}</Tag> },
        { title: '狀態', dataIndex: 'is_active', render: a => <Tag color={a?'green':'red'}>{a?'啟用':'停用'}</Tag> },
        { title: '操作', render: (_, r) => (
          <Space>
            <Button type="link" size="small" onClick={() => handleEditPolicy(r)}>編輯</Button>
            <Button type="primary" size="small" icon={<SettingOutlined />} onClick={() => openVersionDrawer(r)}>管理版本</Button>
          </Space>
        )}
      ]} />

      <Modal title="電價制度設定" open={isPolicyModalOpen} onOk={onSavePolicy} onCancel={() => setIsPolicyModalOpen(false)} destroyOnClose>
        <Form form={policyForm} layout="vertical">
          <Form.Item name="plan_code" label="制度代碼" rules={[{required: true}]}><Input/></Form.Item>
          <Form.Item name="plan_name" label="制度名稱" rules={[{required: true}]}><Input/></Form.Item>
          <Form.Item name="voltage_type" label="電壓類型" rules={[{required: true}]}><Select><Option value="LOW_VOLTAGE">低壓</Option><Option value="HIGH_VOLTAGE">高壓</Option><Option value="EXTRA_HIGH_VOLTAGE">特高壓</Option></Select></Form.Item>
          <Form.Item name="plan_source" label="來源"><Input/></Form.Item>
          <Form.Item name="is_active" label="啟用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      {/* 第二層: 版本管理 Drawer */}
      <Drawer title={`版本管理 - ${selectedPolicy?.plan_name}`} width={600} open={isVersionDrawerOpen} onClose={() => setIsVersionDrawerOpen(false)}>
        <Button type="dashed" block icon={<PlusOutlined />} style={{marginBottom: 16}} onClick={() => { setEditingVersion(null); versionForm.resetFields(); versionForm.setFieldsValue({tariff_plan_id: selectedPolicy.id, is_active: true}); setIsVersionModalOpen(true); }}>新增制度版本</Button>
        <Table size="small" rowKey="id" dataSource={versionData.filter(v => v.tariff_plan_id === selectedPolicy?.id)} columns={[
          { title: '版本名稱', dataIndex: 'version_name' },
          { title: '類型', dataIndex: 'version_type' },
          { title: '操作', render: (_, r) => (
            <Space>
              <Button type="link" size="small" onClick={() => handleEditVersion(r)}>編輯</Button>
              <Button type="link" size="small" icon={<UnorderedListOutlined />} onClick={() => openDetailDrawer(r)}>明細</Button>
            </Space>
          )}
        ]} />
      </Drawer>

      <Modal title="版本設定" open={isVersionModalOpen} onOk={onSaveVersion} onCancel={() => setIsVersionModalOpen(false)} destroyOnClose>
        <Form form={versionForm} layout="vertical">
          <Form.Item name="tariff_plan_id" hidden><Input/></Form.Item>
          <Form.Item name="version_code" label="版本代碼" rules={[{required: true}]}><Input/></Form.Item>
          <Form.Item name="version_name" label="版本名稱" rules={[{required: true}]}><Input/></Form.Item>
          <Form.Item name="version_type" label="版本類型" rules={[{required: true}]}><Select><Option value="SUMMER">夏月</Option><Option value="NON_SUMMER">非夏月</Option></Select></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="effective_start_date" label="起始日" rules={[{required: true}]}><DatePicker style={{width:'100%'}}/></Form.Item></Col>
            <Col span={12}><Form.Item name="effective_end_date" label="結束日"><DatePicker style={{width:'100%'}}/></Form.Item></Col>
          </Row>
          <Form.Item name="is_active" label="啟用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      {/* 第三層: 明細管理 Drawer */}
      <Drawer title={`時段明細 - ${selectedVersion?.version_name}`} width={600} open={isDetailDrawerOpen} onClose={() => setIsDetailDrawerOpen(false)}>
        <Button type="dashed" block icon={<PlusOutlined />} style={{marginBottom: 16}} onClick={() => { setEditingDetail(null); detailForm.resetFields(); detailForm.setFieldsValue({tariff_period_version_id: selectedVersion.id, is_active: true}); setIsDetailModalOpen(true); }}>新增時段明細</Button>
        <Table size="small" rowKey="id" dataSource={detailData.filter(d => d.tariff_period_version_id === selectedVersion?.id)} columns={[
          { title: '類型', dataIndex: 'period_type', render: t => <Tag>{t}</Tag> },
          { title: '起訖', render: (_, r) => `${r.start_time} - ${r.end_time}` },
          { title: '單價', dataIndex: 'energy_price' },
          { title: '操作', render: (_, r) => <Button type="link" size="small" onClick={() => handleEditDetail(r)}>編輯</Button> }
        ]} />
      </Drawer>

      <Modal title="時段明細設定" open={isDetailModalOpen} onOk={onSaveDetail} onCancel={() => setIsDetailModalOpen(false)} destroyOnClose>
        <Form form={detailForm} layout="vertical">
          <Form.Item name="tariff_period_version_id" hidden><Input/></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="period_code" label="代碼" rules={[{required: true}]}><Input/></Form.Item></Col>
            <Col span={12}><Form.Item name="period_name" label="名稱" rules={[{required: true}]}><Input/></Form.Item></Col>
          </Row>
          <Form.Item name="period_type" label="時段類型" rules={[{required: true}]}><Select><Option value="PEAK">尖峰</Option><Option value="MID_PEAK">半尖峰</Option><Option value="OFF_PEAK">離峰</Option></Select></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="timeRange" label="起訖時間" rules={[{required: true}]}><TimePicker.RangePicker format="HH:mm" style={{width:'100%'}}/></Form.Item></Col>
            <Col span={12}><Form.Item name="energy_price" label="流動單價" rules={[{required: true}]}><InputNumber style={{width:'100%'}} precision={2}/></Form.Item></Col>
          </Row>
          <Form.Item name="days" label="適用日" rules={[{required: true}]}><Checkbox.Group options={[{label:'平日', value:'weekday'},{label:'週六', value:'saturday'},{label:'假日', value:'holiday'}]} /></Form.Item>
          <Form.Item name="is_active" label="啟用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

    </Card>
  );
};


// ============================================================================
// 主應用程式入口
// ============================================================================
export default function App() {
  const [menu, setMenu] = useState('plants');

  const renderContent = () => {
    switch (menu) {
      case 'plants': return <PlantHub />;
      case 'clients': return <ClientHub />;
      case 'contracts': return <ContractHub />;
      case 'policies': return <PricingPolicyHub />;
      default: return <PlantHub />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={260} theme="dark">
        <div style={{ height: 64, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold' }}>CPPA 售電平台</div>
        {/* 側邊欄精簡為 4 個核心樞紐 */}
        <Menu theme="dark" mode="inline" selectedKeys={[menu]} onClick={e => setMenu(e.key)} items={[
          { key: 'plants', icon: <ThunderboltOutlined />, label: '發電案場管理' },
          { key: 'clients', icon: <TeamOutlined />, label: '客戶與電號管理' },
          { key: 'policies', icon: <MoneyCollectOutlined />, label: '電價制度管理' },
          { key: 'contracts', icon: <FileTextOutlined />, label: 'CPPA 合約管理' },
        ]} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', boxShadow: '0 1px 4px rgba(0,21,41,.08)' }}>
          <h3>基礎資料與制度設定模組</h3>
        </Header>
        <Content style={{ margin: '24px' }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
}