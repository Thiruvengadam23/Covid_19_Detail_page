const express = require("express");
const app = express();
const { open } = require("sqlite");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

app.use(express.json());
let db = null;

const initializeDatabaseAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
  } catch (e) {
    console.log(`Database Error ${e.message}`);
    process.exit(1);
  }
};

initializeDatabaseAndServer();

app.listen(3000, () => {
  console.log("server is running");
});

const authorizeToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.header["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ") / [1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//LOGIN API

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const checkUserQuery = `SELECT * FROM user WHERE username='${username}'`;
  const databaseUser = await db.get(checkUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "SECRET");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//GETTING ALL STATES

app.get("/states/", authorizeToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state`;
  const allState = await db.all(getStatesQuery);
  const result = (each) => {
    return {
      stateId: each.state_id,
      stateName: each.state_name,
      population: each.population,
    };
  };

  response.send(allState.map((each) => result(each)));
});

//GETTING PARTICULAR STATE

app.get("/states/:stateId/", authorizeToken, async (request, response) => {
  const { stateId } = request.params;
  const getSingleStateQuery = `SELECT * FROM state
     WHERE state_id='${stateId}}'`;
  const dbState = await db.get(getSingleStateQuery);
  const result = {
    stateId: dbState.state_id,
    stateName: dbState.state_name,
    population: dbState.population,
  };
  response.send(result);
});

//CREATE NEW DISTRICT

app.post("/districts/", authorizeToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const newDistrictQuery = `INSERT INTO district 
    (district_name,state_id,cured,active,deaths)
    VALUES (
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths},
    )`;
  const newDistrict = await db.run(newDistrictQuery);
  const district_id = newDistrict.lastID;
  response.send("District Successfully Added");
});

//GETTING PARTICULAR DISTRICT

app.get(
  "/districts/:districtId/",
  authorizeToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getSingleDistrict = `SELECT * FROM district
     WHERE district_id=${districtId} `;
    const dbDistrict = await db.get(getSingleDistrict);
    const result = {
      districtId: dbDistrict.district_id,
      districtName: `${dbDistrict.district_name}`,
      stateId: dbDistrict.state_id,
      cases: dbDistrict.cases,
      cured: dbDistrict.cured,
      active: dbDistrict.active,
      deaths: dbDistrict.deaths,
    };
    response.send(result);
  }
);

//DELETE DISTRICT

app.delete(
  "/districts/:districtId/",
  authorizeToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district 
    WHERE district_id=${districtId}`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//UPDATE DISTRICT

app.put(
  "/districts/:districtId/",
  authorizeToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `UPDATE district
      SET
       district_name='${districtName}',
       state_id=${stateId},
       cases=${cases},
       cured=${cured},
       active=${active},
       deaths=${deaths}
       WHERE
       district_id=${districtId};
      `;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//TOTAL CASES BASED ON STATE

app.get(
  "/states/:stateId/stats/",
  authorizeToken,
  async (request, response) => {
    const { stateId } = request.params;
    const stateDetailQuery = `SELECT 
      SUM(cases) AS totalCases,
      SUM(cured) AS totalCured,
      SUM(active) AS totalActive,
      SUM(deaths) AS totalDeaths
      FROM district
      WHERE state_id=${stateId}`;
    const totalResult = await db.run(stateDetailQuery);
    response.send(totalResult);
  }
);
module.exports = app;
