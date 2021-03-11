const https = require("https");

// COMPANY_ID and SERVICE_ID is sniffed from API requests depending on event you need
// Format for both values is "k8j976h7-222f-452x-6759-j7k8h6g5ry6u", can be found in API as well
const COMPANY_ID = "k8j976h7-222f-452x-6759-j7k8h6g5ry6u";
const SERVICE_ID = "l64g6h8f-g42f-422x-0967-sj87h6g5t623";

// Bearer auth token is valid for 24 hours, then needs to be renewed
const AUTH_TOKEN = "Bearer <%token here%>";

// Spendo is unique per device and are different for registration and event calendar fetch (64 bit hash)
const SPENDO_S_IG_REG = "1";
const SPENDO_S_IG_FETCH = "2";
const SPENDO_DEVICE_ID = "12345-22-66666-987654321";

const SPOTS_TO_RESERVE = 3;
const EVENT_DATE = "2021-01-31";
const EVENT_PARAMS = {
    "serviceId": SERVICE_ID,
    "calendarId": null,
    "spots": SPOTS_TO_RESERVE,
};

// This means that script will search for timeslots from 10:00 till 15:00
const SEARCH_FOR_SLOTS_FROM_HOURS = 10;
const SEARCH_FOR_SLOTS_TO_HOURS = 15;

const NUMBER_OF_REQUESTS = 1000;
const REQUEST_INTERVAL = 1000;
const REQUEST_ENDPOINT = "/api/v3/timeslots";
const REGISTRATION_ENDPOINT = "/api/v2/reservations/request";

const getHeaderOptions = (path, isReg, dataLen) => {
    return {
        hostname: "bookla.eu",
        port: 443,
        path: path,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": dataLen,
            "SpendoSig": isReg ? SPENDO_S_IG_REG : SPENDO_S_IG_FETCH,
            "SpendoDeviceID": SPENDO_DEVICE_ID,
            "SpendoApp": "iOS/Client",
            "Authorization": AUTH_TOKEN,
        }
    }
};

const getRequestData = () => JSON.stringify({
    companyId: COMPANY_ID,
    slotParams: EVENT_PARAMS,
    date: EVENT_DATE,
});

const getRegistrationData = (startDate, calendarId, slotId) => JSON.stringify({
    serviceId: SERVICE_ID,
    startDate: startDate,
    calendarId: calendarId,
    type: "slot",
    spots: SPOTS_TO_RESERVE,
    slotId: slotId,
    comment: ""
});

let amountOfRequests = 0;
let isRegistrationDone = false;

const requestInterval = setInterval(() => {
    const request = https.request(
        getHeaderOptions(REQUEST_ENDPOINT, false, getRequestData().length), response => {
            // Requests response is limited, so we meed to collect all buffer data before parse it
            const collectedData = [];

            response.on("data", data => {
                collectedData.push(data);
            }).on("end", () => {
                const buffer = Buffer.from(collectedData);
                const parsedResponse = JSON.parse(buffer);

                console.log("Total request:", amountOfRequests);
                console.log("Request at:", new Date().toLocaleString());

                parsedResponse.calendars.map((item) => {
                    if (item.timeslots.length > 0) {
                        const calendarId = item.calendarId;

                        console.log("Available slots:", item.timeslots.map(slot => {
                            if (isRegistrationDone) return;

                            const timeslot = new Date(slot.startTime);
                            const hours = timeslot.getHours();
                            const minutes = timeslot.getMinutes();

                            if (hours >= SEARCH_FOR_SLOTS_FROM_HOURS && hours <= SEARCH_FOR_SLOTS_TO_HOURS) {
                                registerForEvent(slot.slotId, slot.startDate, calendarId);
                            }

                            return `${hours}:${minutes < 9 ? "0" + minutes : minutes}`;
                        }));
                    } else {
                        console.log("No slots available!");
                    }
                })

                amountOfRequests++;

                if (amountOfRequests > NUMBER_OF_REQUESTS || isRegistrationDone) {
                    clearInterval(requestInterval);
                }
            })
        }
    )

    request.on("error", error => {
        console.error(error);
        clearInterval(requestInterval);
    });
    request.write(getRequestData());
    request.end();
}, REQUEST_INTERVAL);

const registerForEvent = (slotId, startDate, calendarId) => {
    console.log("Registering... api sucks, may time out on load 🤷‍♂️");

    const registrationData = getRegistrationData(startDate, calendarId, slotId);

    const request = https.request(
        getHeaderOptions(REGISTRATION_ENDPOINT, true, registrationData.length), response => {
            response.on("data", data => {
                const buf = Buffer.from(data, "utf8");
                const parsedResponse = JSON.parse(buf);
                console.log(parsedResponse);
                console.log("Registered! 🚀");
            });
        }
    )

    isRegistrationDone = true;

    request.on("error", error => console.error(error));
    request.write(registrationData);
    request.end();
}
