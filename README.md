# Gharkhata — Android Landlord Management App

Standalone local Android app for managing tenants, monthly rent, electricity + water bills, WiFi/internet bills, expenses and tenant-wise history.

## Tenant detail
Tap any tenant, such as **Ramesh Sharma**, to see:
- Monthly rent
- Rent paid for the current month
- Remaining pending amount
- Rent payment history with date and month
- Electricity + water total and history
- WiFi / Internet total and history
- Add Rent Paid
- Add Bill
- Add WiFi

## Billing
Electricity bill = units × rate.
Electricity + water are combined into the tenant's total utility bill.
WiFi / Internet = number of months × monthly amount.

## Storage
- Android: SQLite using `@capacitor-community/sqlite`
- Browser testing: localStorage fallback
- No cloud/backend is required for normal use.

## Run
```bash
npm install
npm run dev
```

## Android
```bash
npm run cap:add
npm run android
```

If the Android platform already exists, use:
```bash
npm run cap:sync
npx cap open android
```


## Final update (1.0.1)
- Tenant uses No. of Rooms instead of Room Number.
- Monthly room rent = rent per room × number of rooms.
- Tenant total due = room rent + electricity/water + WiFi/internet − all recorded payments.
- WhatsApp due-message sharing added.
- Android launcher icon replaced with the supplied Gharkhata artwork.
- Existing SQLite/localStorage data is migrated without deleting existing records.
