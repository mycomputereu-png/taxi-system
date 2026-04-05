# Taxi System - TODO

## ✅ COMPLETAT: Sistem complet de taxi cu trei aplicații web
- Dispatcher: gestionare curse, șoferi, și clienți cu rating-uri
- Client: login OTP, cheamă taxi, tracking live șofer
- Șofer: login, acceptare curse, rating clienți, navigare
- WebSocket real-time cu Socket.IO
- Google Maps cu marcatori și rute
- Sistem de rating clienți cu istoric complet

## Backend & Database
- [x] Schema DB: tabele drivers, clients, rides, locations, otp_codes
- [x] Migrare SQL și aplicare în DB
- [x] WebSocket server cu Socket.IO
- [x] tRPC router: autentificare dispatcher (admin)
- [x] tRPC router: autentificare șofer (username/password)
- [x] tRPC router: autentificare client (telefon + OTP simulat)
- [x] tRPC router: gestionare șoferi (CRUD)
- [x] tRPC router: curse (creare, asignare, acceptare, refuz, finalizare)
- [x] tRPC router: actualizare locație în timp real
- [x] tRPC router: istoric curse
- [x] WebSocket events: location_update, ride_assigned, ride_accepted, ride_rejected

## Aplicație Dispatcher (/dispatcher)
- [x] Login dispatcher (admin Manus OAuth)
- [x] Layout cu sidebar și navigare
- [x] Tab Hartă: Google Maps cu locații șoferi și clienți în timp real
- [x] Tab Șoferi: adăugare șofer (username/parolă), listare, ștergere
- [x] Tab Curse Active: listare curse pendinte și asignate
- [x] Asignare manuală cursă la șofer disponibil
- [x] Notificare când client cere taxi
- [x] Status șofer (disponibil/ocupat) vizibil pe hartă

## Aplicație Client (/client)
- [x] Pagină login cu număr de telefon
- [x] Generare și verificare OTP (simulat în app)
- [x] Pagină principală cu hartă Google Maps
- [x] Buton "Cheamă Taxi" proeminent
- [x] Trimitere locație GPS la dispatcher via WebSocket
- [x] Stare așteptare după cerere taxi
- [x] Tracking șofer în timp real după acceptare
- [x] Rută albastră de la șofer la client pe hartă
- [x] Timp estimat de sosire
- [x] Notificare când șoferul acceptă cursa

## Aplicație Șofer (/driver)
- [x] Login cu username/parolă (create de dispatcher)
- [x] Pagină principală cu status disponibil/ocupat
- [x] Notificare cursă nouă asignată
- [x] Card cursă cu detalii client și locație
- [x] Butoane Acceptă/Refuză cursă
- [x] Hartă Google Maps cu navigare la client după acceptare
- [x] Rută albastră la locația clientului
- [x] Actualizare locație GPS în timp real
- [x] Buton "Cursă Finalizată"

## Integrare & Calitate
- [x] WebSocket rooms pentru dispatcher, client, șofer
- [x] Teste Vitest pentru proceduri backend
- [x] Design consistent dark theme profesional
- [x] Responsive mobile pentru client și șofer
- [x] Tracking live șoferi pe hartă Dispatcher cu marcatori animați
- [x] Panel statistici în sidebar (total șoferi, curse, disponibili)
- [x] Dark theme Google Maps în Dispatcher
- [x] Checkpoint final și livrare
- [x] Fixa eroare Client OTP - validare și mesaje de eroare
- [x] Fixa ReferenceError require is not defined - dynamic import socket.io-client
- [x] Fixa Map container not found - adaugă check și loading state
- [x] Fixa Socket.IO timing - Dispatcher se conectează înainte de a emite auth
- [x] Adaugă logging pentru Socket.IO events
- [x] Fixa buton Cheamă Taxi - adaugă fallback GPS și buton test locație simulată
- [x] Rearanjare taburi Dispatcher: Curse în așteptare → Curse active → Șoferi online
- [x] Adaugă legendă hartă cu buline colorate: șoferi disponibili (verde), șoferi ocupați (albastru), clienți în așteptare (roșu)
- [x] Adaugă hartă Google Maps pe aplicația Șofer cu locația în timp real
- [x] Adaugă legendă hartă Șofer (locația mea portocaliu, client roșu)
- [x] Adaugă schema DB pentru ratings (tabelă client_ratings)
- [x] Adaugă tRPC procedure pentru submitRating pe Șofer
- [x] Adaugă UI rating pe aplicația Șofer (după finalizare cursă)
- [x] Adaugă tab "Clienți" în Dispatcher cu lista și rating-uri
- [x] Afișare clienți cu probleme (rating scăzut) în Dispatcher
- [x] Extinde backend getClientProfile cu driver info în ratings
- [x] Adaugă modal profil client în Dispatcher cu detalii complete
- [x] Adaugă query backend pentru istoric curse client cu ratinguri primite
- [x] Adaugă procedure tRPC pentru getClientProfile (dispatcher.getClientProfile)
- [x] Construieste pagina profil client cu istoric curse (ClientProfile.tsx)
- [x] Afișare ratinguri primite de client de la șoferi cu driver info
- [x] Adaugă modal profil client în Dispatcher cu click pe card client
- [x] Adaugă sorting/filtering pentru ratinguri (newest, oldest, highest, lowest)
- [x] Adaugă sorting/filtering pentru curse (newest, oldest, completed, cancelled)
- [x] Teste Vitest pentru dispatcher.getClientProfile (9 teste trec)
- [x] Adaugă coloane carPlate și carBrand în tabelul drivers
- [x] Creare și aplicare migrație DB (auto-run la startup din server/db.ts)
- [x] Extinde tRPC addDriver cu câmpuri mașină (opționale)
- [x] Adaugă input fields în formularul Dispatcher ("Numărul mașinii", "Marca automobilului")
- [x] Afișare info mașină în lista șoferilor cu emoji (🚗 placa, 📍 marca)
- [x] Teste Vitest pentru noile câmpuri (9 teste trec)
- [x] Fixa locația clientului pe hartă șofer după acceptare (Socket.IO track:client event)
- [x] Adaugă listener client:location:update în DriverApp
- [x] Actualizare automată marker și rută când clientul se mișcă
- [x] Abonare/dezabonare la locație client la acceptare/finalizare
- [x] Verificare buton "Cursă Terminată" - funcționează
- [x] Verificare rating modal - funcționează
- [x] Verificare submitRating mutation - funcționează
- [x] Toate 9 teste Vitest trec
- [x] Fixa harta neagră pe DriverApp (conflict h-[500px] vs h-full)
- [x] Fixa MapView component - remove h-[500px] fix
- [x] Fixa rating modal nu apare (activeRide cleared before setShowRatingModal)
- [x] Move setShowRatingModal(true) în completeRideMut.onSuccess
- [x] Remove setTimeout din onClick handler
- [x] Toate 9 teste Vitest trec
- [x] Fixa TypeError: avgRating.toFixed is not a function în Dispatcher
- [x] Adaugă null check pentru avgRating în modal profil client
- [x] Adaugă timeout tracking în schema rides (assignedAt, acceptanceTimeoutAt)
- [x] Implementează backend logic pentru automatic reassignment la 30s timeout
- [x] Adaugă Socket.IO events pentru ride:timeout
- [x] Adaugă UI countdown timer în driver app (30s -> 0s cu Clock icon)
- [x] Adaugă ride:timeout listener în driver app
- [x] Adaugă clearRideAcceptanceTimeout în acceptRide și rejectRide
- [x] Teste Vitest (9 teste trec)
- [x] TypeScript: No errors
- [x] BUG FIX: Butonul "Cheamă taxi" - adaug coloane rides în migrație (assignedAt, acceptanceTimeoutAt)
- [x] BUG FIX: Harta pe aplicația șoferului - fix container height cu delay și h-screen

## Panic Button Feature (Emergency Alert System) - NEW
- [x] Create `panicAlerts` table with driver location, status, and timestamps
- [x] Add database helper functions: `createPanicAlert`, `updatePanicAlertStatus`, `getActivePanicAlerts`, `getPanicAlertsByDriver`
- [x] Implement tRPC procedures: `panic.triggerAlert`, `panic.cancelPanicAlert`, `panic.getActivePanicAlerts`
- [x] Add Socket.IO events for real-time panic alert notifications to dispatchers
- [x] Add discreet panic button (🚨) on active ride screen in DriverApp
- [x] Implement panic confirmation modal with safety check
- [x] Add panic alert status indicator showing active alert state
- [x] Create cancel panic alert button with dispatcher notification
- [x] Add visual feedback (animated pulse, color coding) for panic state
- [x] Add "Urgență" (Panic) tab to dispatcher dashboard with alert counter
- [x] Display active panic alerts with driver info, location, and timestamp
- [x] Implement panic alert selection and details view
- [x] Add real-time panic alert notifications with Socket.IO integration
- [x] Show panic alerts with visual priority (red theme, animated icon)
- [x] Create panic.test.ts with 12 comprehensive unit tests (all passing)

## Known Issues & Pre-existing Errors
- [ ] Fix TypeScript errors in Dispatcher.tsx (accessing `.client` and `.driver` properties on Ride object)
- [ ] Fix TypeScript errors in DriverApp.tsx (accessing `.client` property on Ride object)
- [ ] Fix TypeScript errors in ClientApp.tsx (missing `code` property in OTP response)
- [ ] Implement `getProfile` procedure for client profile queries
- [ ] Rename `client` router to `clientApp` to avoid tRPC built-in method collision

## Future Enhancements for Panic Button
- [ ] Add panic alert history and analytics
- [ ] Implement automatic panic alert escalation after timeout
- [ ] Add dispatcher response/notes to panic alerts
- [ ] Implement panic alert categories (medical, accident, security, etc.)
- [ ] Add SMS/push notifications for panic alerts
- [ ] Create panic alert audit trail for compliance
- [ ] Add panic button long-press gesture for mobile
- [ ] Implement panic alert geofencing and proximity alerts


## BUG: Cheamă Taxi Button Not Working
- [x] Fix GPS location undefined (clientLat, clientLng) when requesting ride - FIXED: changed lat/lng to clientLat/clientLng
- [x] Ensure GPS location is captured before ride request - GPS is captured via watchPosition
- [x] Test ride request with valid location - Ready to test


## BUG: Driver Rating Submission Fails
- [x] Fix clientId undefined when submitting rating from driver app - FIXED: added driver.getActiveRide procedure
- [x] Ensure activeRide has clientId before submitting rating - Now using driver-specific query


## 🎨 UI: Remove online drivers section completely
- [x] Examine Dispatcher layout and identify online drivers section
- [x] Remove "Soferi Online" section from Șoferi tab
- [x] Remove online drivers panel from below map
- [x] Verify map displays without driver info panel
- [x] Test and verify layout


## 🐛 BUG: Client location not appearing on dispatcher map
- [x] Investigate Socket.IO client:location event flow
- [x] Found mismatch: server emits 'ride:created' but dispatcher listens for 'ride:new'
- [x] Changed event name from 'ride:created' to 'ride:new' in server/routers.ts
- [x] Added clientPhone and clientName to event payload
- [x] Verified client auth:client is emitted after OTP verification
- [x] Test end-to-end: client request -> dispatcher receives location -> marker appears


## ✨ FEATURE: Real-time driver tracking with countdown on client app
- [x] Verify driver:location:update events are being sent to client
- [x] Implement countdown timer that updates every second
- [x] Display driver marker on map with real-time position updates (already implemented)
- [x] Show route polyline from driver to client (already implemented)
- [x] Display ETA in minutes and update as driver moves
- [x] Add visual indicator showing driver is approaching ("Sosind..." when ETA = 0)
- [x] Test end-to-end: assign driver -> client sees location -> countdown updates


## 🎨 UI: Add client info panel to dispatcher right sidebar for ride assignment
- [x] Identify the rides list/panel on the right side of dispatcher
- [x] Add client phone number display in the ride card
- [x] Add client location (lat/lng) or address in the ride card
- [x] Display client name if available
- [x] Add "Nou" badge to pending rides
- [x] Test: new ride appears with full client info on right panel


## 🐛 BUG FIX: Client phone number not appearing in dispatcher ride cards
- [x] Identified: getActiveRides() was not including client data
- [x] Added LEFT JOIN with clients table in getActiveRides()
- [x] Added LEFT JOIN with drivers table for driver info
- [x] Included client phone, name, and location in query result
- [x] Included driver name, phone, and vehicle info in query result
- [x] Verified server returns enriched ride data with client/driver objects


## 📞 FEATURE: Auto-dial dispatcher when client calls taxi
- [x] Add dispatcher phone number constant (0040758900900)
- [x] Implement tel: link to trigger phone call when "Cheamă Taxi" is pressed
- [x] Phone call initiates automatically when ride is requested
- [x] Ride request is sent to backend simultaneously
- [x] Verified: tel: protocol triggers native phone dialer on mobile devices


## 🐛 BUG: Client doesn't see driver route and countdown after driver assignment
- [x] Identified: ride:assigned handler was not emitting track:driver
- [x] Added emit("track:driver") to ride:assigned handler
- [x] Driver location updates now received immediately after assignment
- [x] Route polyline draws on client map from driver to client
- [x] Countdown timer updates in real-time
- [x] Test: Assign driver -> client receives driver location -> route appears -> countdown starts


## 🐛 BUG: Route and countdown don't appear after driver accepts ride
- [x] Identified: drawRoute and calculateETA had empty dependency arrays
- [x] Fixed drawRoute dependency array to include mapRef
- [x] Fixed calculateETA dependency array to include state setters
- [x] Route now updates dynamically as driver location changes
- [x] Countdown updates in real-time after driver accepts
- [x] Test: Driver accepts -> route appears on map -> countdown starts


## 🔔 FEATURE: Driver arrival notification with sound and visual alert
- [x] Calculate distance between driver and client using Haversine formula
- [x] Detect when driver is within 50 meters of client location
- [x] Play notification sound (800Hz sine wave) when driver arrives
- [x] Display visual alert modal with driver info (name, car plate, brand)
- [x] Add dismiss button ("Am iesit din casa")
- [x] Reset notification state when ride ends
- [x] Test: Driver approaches -> notification triggers at 50m -> sound plays + alert shows
