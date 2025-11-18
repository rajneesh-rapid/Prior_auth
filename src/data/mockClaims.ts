import { Claim } from "@/types/claim";

export const mockClaims: Claim[] = [
  {
    claimId: "CLM-2024-001",
    patientName: "John Anderson",
    dateOfService: "2024-01-15",
    totalAmt: 4250.0,
    acceptedAmt: 3800.0,
    deniedAmt: 450.0,
    approvalStatus: "Partially Approved",
    queryReason: "ECG procedure requires prior authorization documentation. Please provide authorization number or medical necessity justification.",
    statusHistory: [
      { date: "2024-01-15", label: "Submitted", user: "System" },
      { date: "2024-01-21", label: "Under Review", user: "Dr. Sarah Williams" },
      { date: "2024-01-23", label: "Partially Approved", user: "Claims Manager" },
    ],
    documents: [
      {
        id: "doc-1",
        name: "medical_report.pdf",
        size: 245000,
        uploadDate: "2024-01-16",
      },
      {
        id: "doc-2",
        name: "prescription.pdf",
        size: 120000,
        uploadDate: "2024-01-16",
      },
    ],
    items: [
      {
        itemCode: "99213",
        procedure: "Office Visit - Established Patient",
        amount: 150.0,
        approvedAmt: 150.0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-15", label: "Submitted" },
          { date: "2024-01-21", label: "Accepted", user: "Dr. Sarah Williams" },
        ],
      },
      {
        itemCode: "80053",
        procedure: "Comprehensive Metabolic Panel",
        amount: 85.0,
        approvedAmt: 85.0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-15", label: "Submitted" },
          { date: "2024-01-21", label: "Accepted", user: "Dr. Sarah Williams" },
        ],
      },
      {
        itemCode: "93000",
        procedure: "Electrocardiogram (ECG)",
        amount: 450.0,
        approvedAmt: 0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-15", label: "Submitted" },
          { date: "2024-01-20", label: "Under Review", user: "Dr. Sarah Williams" },
          { date: "2024-01-23", label: "Denied", user: "Medical Review Board" },
        ],
        reasonHistory: [
          {
            date: "2024-01-23",
            label: "Prior Authorization Missing",
            user: "Medical Review Board",
            comment: "Prior authorization required but not obtained",
          },
        ],
      },
      {
        itemCode: "36415",
        procedure: "Venipuncture",
        amount: 25.0,
        approvedAmt: 25.0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-15", label: "Submitted" },
          { date: "2024-01-21", label: "Accepted", user: "Dr. Sarah Williams" },
        ],
      },
    ],
  },
  {
    claimId: "CLM-2024-002",
    patientName: "Sarah Mitchell",
    dateOfService: "2024-01-18",
    totalAmt: 12500.0,
    acceptedAmt: 12500.0,
    deniedAmt: 0,
    approvalStatus: "Accepted",
    statusHistory: [
      { date: "2024-01-18", label: "Submitted", user: "System" },
      { date: "2024-01-24", label: "Under Review", user: "Dr. Michael Roberts" },
      { date: "2024-01-25", label: "Accepted", user: "Claims Manager" },
    ],
    documents: [
      {
        id: "doc-3",
        name: "surgery_notes.pdf",
        size: 580000,
        uploadDate: "2024-01-19",
      },
    ],
    items: [
      {
        itemCode: "27447",
        procedure: "Total Knee Arthroplasty",
        amount: 10000.0,
        approvedAmt: 10000.0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-18", label: "Submitted" },
          { date: "2024-01-24", label: "Under Review", user: "Dr. Michael Roberts" },
          { date: "2024-01-25", label: "Accepted", user: "Medical Review Board" },
        ],
      },
      {
        itemCode: "01402",
        procedure: "Anesthesia for Knee Surgery",
        amount: 2000.0,
        approvedAmt: 2000.0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-18", label: "Submitted" },
          { date: "2024-01-25", label: "Accepted", user: "Dr. Michael Roberts" },
        ],
      },
      {
        itemCode: "99232",
        procedure: "Hospital Inpatient Care",
        amount: 500.0,
        approvedAmt: 500.0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-18", label: "Submitted" },
          { date: "2024-01-25", label: "Accepted", user: "Dr. Michael Roberts" },
        ],
      },
    ],
  },
  {
    claimId: "CLM-2024-003",
    patientName: "Michael Chen",
    dateOfService: "2024-01-20",
    totalAmt: 2850.0,
    acceptedAmt: 1950.0,
    deniedAmt: 900.0,
    approvalStatus: "Partially Approved",
    queryReason: "CT Scan Head without Contrast denied due to insufficient documentation of medical necessity. Additional clinical notes requested from medical board.",
    statusHistory: [
      { date: "2024-01-20", label: "Submitted", user: "System" },
      { date: "2024-01-26", label: "Under Review", user: "Dr. Emily Parker" },
      { date: "2024-01-27", label: "Partially Approved", user: "Claims Manager" },
    ],
    documents: [
      {
        id: "doc-4",
        name: "lab_results.pdf",
        size: 95000,
        uploadDate: "2024-01-21",
      },
    ],
    items: [
      {
        itemCode: "99214",
        procedure: "Office Visit - Detailed",
        amount: 200.0,
        approvedAmt: 200.0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-20", label: "Submitted" },
          { date: "2024-01-26", label: "Accepted", user: "Dr. Emily Parker" },
        ],
      },
      {
        itemCode: "70450",
        procedure: "CT Scan Head without Contrast",
        amount: 900.0,
        approvedAmt: 0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-20", label: "Submitted" },
          { date: "2024-01-26", label: "Under Review", user: "Dr. Emily Parker" },
          { date: "2024-01-27", label: "Denied", user: "Medical Review Board" },
        ],
        reasonHistory: [
          {
            date: "2024-01-27",
            label: "Insufficient Documentation",
            user: "Medical Review Board",
            comment: "Medical necessity not documented",
          },
          {
            date: "2024-01-28",
            label: "Query Raised",
            user: "Claims Reviewer",
            comment: "Requesting medical board to provide additional clinical notes",
          },
        ],
      },
      {
        itemCode: "85025",
        procedure: "Complete Blood Count",
        amount: 45.0,
        approvedAmt: 45.0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-20", label: "Submitted" },
          { date: "2024-01-26", label: "Accepted", user: "Dr. Emily Parker" },
        ],
      },
    ],
  },
  {
    claimId: "CLM-2024-004",
    patientName: "Emily Rodriguez",
    dateOfService: "2024-01-22",
    totalAmt: 6200.0,
    acceptedAmt: 6200.0,
    deniedAmt: 0,
    approvalStatus: "Under Review",
    statusHistory: [
      { date: "2024-01-22", label: "Submitted", user: "System" },
      { date: "2024-01-28", label: "Under Review", user: "Dr. James Anderson" },
    ],
    documents: [],
    items: [
      {
        itemCode: "45378",
        procedure: "Colonoscopy with Biopsy",
        amount: 3500.0,
        approvedAmt: 3500.0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-22", label: "Submitted" },
          { date: "2024-01-28", label: "Accepted", user: "Dr. James Anderson" },
        ],
      },
      {
        itemCode: "00810",
        procedure: "Anesthesia for Colonoscopy",
        amount: 800.0,
        approvedAmt: 800.0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-22", label: "Submitted" },
          { date: "2024-01-28", label: "Accepted", user: "Dr. James Anderson" },
        ],
      },
      {
        itemCode: "88305",
        procedure: "Tissue Pathology Examination",
        amount: 250.0,
        approvedAmt: 0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-22", label: "Submitted" },
          { date: "2024-01-29", label: "Pending", user: "Lab Technician" },
        ],
      },
    ],
  },
  {
    claimId: "CLM-2024-005",
    patientName: "David Thompson",
    dateOfService: "2024-01-25",
    totalAmt: 1850.0,
    acceptedAmt: 950.0,
    deniedAmt: 900.0,
    approvalStatus: "Under Review",
    queryReason: "MRI Lower Extremity requires missing documentation. Requesting medical board to provide required documents for review.",
    statusHistory: [
      { date: "2024-01-25", label: "Submitted", user: "System" },
      { date: "2024-01-30", label: "Under Review", user: "Dr. Linda Martinez" },
    ],
    documents: [
      {
        id: "doc-5",
        name: "referral_form.pdf",
        size: 75000,
        uploadDate: "2024-01-26",
      },
    ],
    items: [
      {
        itemCode: "99203",
        procedure: "New Patient Office Visit",
        amount: 250.0,
        approvedAmt: 250.0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-25", label: "Submitted" },
          { date: "2024-01-30", label: "Accepted", user: "Dr. Linda Martinez" },
        ],
      },
      {
        itemCode: "73721",
        procedure: "MRI Lower Extremity",
        amount: 1200.0,
        approvedAmt: 0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-25", label: "Submitted" },
          { date: "2024-01-31", label: "Under Review", user: "Dr. Linda Martinez" },
        ],
        reasonHistory: [
          {
            date: "2024-01-31",
            label: "Query Raised",
            user: "Dr. Linda Martinez",
            comment: "Requesting medical board to provide missing documents",
          },
        ],
      },
      {
        itemCode: "97110",
        procedure: "Physical Therapy",
        amount: 100.0,
        approvedAmt: 100.0,
        qty: 1,
        statusHistory: [
          { date: "2024-01-25", label: "Submitted" },
          { date: "2024-01-30", label: "Accepted", user: "Dr. Linda Martinez" },
        ],
      },
    ],
  },
];
