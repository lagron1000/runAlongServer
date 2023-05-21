const {MongoClient, ObjectId} = require("mongodb");
const Express = require("express");
const BodyParser = require('body-parser');

const server = Express();
server.use(BodyParser.json());
server.use(BodyParser.urlencoded({ extended: true }));

//const client = new MongoClient(process.env["ATLAS_URI"]);
//added "?retryWrites=true&w=majority";" to the end of the string
const uri = "mongodb+srv://shoval:atlas@cluster0.dbts3lw.mongodb.net/test?retryWrites=true&w=majority";

var db;


/**
 * Check if the given user information is valid
 */
async function isValidUser(userInfo) {
    // todo - check if the password is valid in the client side?
    try {
        let findUsername = await db.collection("usersCollection").findOne({"username": userInfo.username});                      
        if(findUsername == null) {
            return true; // username isn't taken - valid user
        }                       
        return false; // invalid user
    } catch (e) {
        console.error(e);
        return false;
    }
}


/**
 * Add the given user to the DB (if it is valid) 
 */
async function addUser(newListing){
    var result = null;
    if (await isValidUser(newListing)) {
        let userObject = {username: newListing.username,
                          nickname: newListing.nickname,
                          rank: 0, 
                          coins: 0,
                          inventory: [],
                          bottom: new ObjectId("6454d79c01ba82fa1931ea53"),
                          top: new ObjectId("6454d76001ba82fa1931ea50"),
                          shoes: new ObjectId("6454d82501ba82fa1931ea56")};
        result = await db.collection("usersCollection").insertOne(userObject);
        let loginInfo = {username: newListing.username,
                         password: newListing.password,
                         userRef: result.insertedId};
        await db.collection("loginInfoCollection").insertOne(loginInfo);
    }
    else {
        console.log("username is taken"); // todo delete
    }
    
    return result;
}


/**
 * POST new user 
 * 'http://localhost:3005/usersCollection'
 */
server.post("/usersCollection", async (request, response, next) => {
    try {
        let result = await addUser(request.body);
        if (result) {
            response.send(result);
        }
        else {
            response.status(404).send();
        }
    } catch (e) {
        response.status(500).send({ message: e.message });
    }
});


/**
 * return the object of the user with the given id
 */
async function getUserById(id) {
    try {
            let result = await db.collection("usersCollection").findOne({"_id": id});                                              
            return result;
        } 
    catch (e) {
        console.error(e);
    }
}


// POST login
// 'http://localhost:3005/login'
server.post("/login", async (request, response, next) => {
    try {
        const { username, password } = request.body;
        const loginInfo = await db.collection("loginInfoCollection").findOne({ "username": username, "password": password });

        if (loginInfo) {
            const user = await getUserById(loginInfo.userRef);
            if (user) {
                response.send(user);
            } else {
                response.status(404).send({ message: "User not found." });
            }
        } else {
            response.status(401).send({ message: "Invalid username or password." });
        }
    } catch (e) {
        response.status(500).send({ message: e.message });
    }
});


/**
 * GET shop items
 * 'http://localhost:3005/clothesCollection'
 */
server.get("/clothesCollection", async (request, response, next) => {
    try {
        let result = await db.collection("clothesCollection").find({});
        if(result) {
            response.send(await result.toArray());
        } 
        else {
            response.status(404).send();
        }
    } catch (e) {
        response.status(500).send({ message: e.message });
    }
});


/**
 * GET items from clothesCollection based on user's inventory
 * 'http://localhost:3005/clothesCollection?username=USERNAME'
 */
server.get("/clothesCollection/inventory/:username", async (request, response, next) => {
    try {
        let username = request.params.username;
        let user = await db.collection("usersCollection").findOne({"username": username});
        if (user) {
            const inventoryIds = user.inventory.map(id => new ObjectId(id));
            const clothes = await db.collection("clothesCollection").find({ "_id": { $in: inventoryIds } }).toArray();
            response.send(clothes);
        } else {
            response.status(404).send({ message: "User not found." });
        }
    } catch (e) {
        response.status(500).send({ message: e.message });
    }
});


/**
 * UPDATE rank by username (increase by 1)
 * 'http://localhost:3005/usersCollection/rank/USERNAME'
 */
server.put("/usersCollection/rank/:username", async (request, response, next) => {
    try {
        let result = await db.collection("usersCollection").updateOne(
            { username: request.params.username },
            { $inc: { rank: 1 } }
        );
        if (result) {
            response.send(result);
        }
        else {
            response.status(404).send();
        }
    } catch (e) {
        response.status(500).send({ message: e.message });
    }
});


/**
 * UPDATE coins given username and amount of coins
 * 'http://localhost:3005/usersCollection/coins?username=USERNAME&amount=AMOUNT'
 */
server.put("/usersCollection/coins", async (request, response, next) => {
    try {
        let result = await db.collection("usersCollection").updateOne(
            { username: request.query.username },
            { $inc: { coins: parseInt(request.query.amount) } }
        );
        if (result) {
            response.send(result);
        }
        else {
            response.status(404).send();
        }
    } catch (e) {
        response.status(500).send({ message: e.message });
    }
});


/**
 * UPDATE invenntory given username and item id
 * 'http://localhost:3005/usersCollection/inventory?username=USERNAME&itemId=ID'
 */
server.put("/usersCollection/inventory", async (request, response, next) => {
    try {
        let result = await db.collection("usersCollection").updateOne(
            { username: request.query.username },
            { $push: {inventory: new ObjectId(request.query.itemId)} }
        );
        if (result) {
            response.send(result);
        }
        else {
            response.status(404).send();
        }
    } catch (e) {
        response.status(500).send({ message: e.message });
    }
});

/**
 * UPDATE the outfit (top, bottom, shoes) of the given user
 * "http://localhost:3005/usersCollection/outfit?username=USERNAME"
 */
server.put("/usersCollection/outfit", async (request, response, next) => {
    try {
        let result = await db.collection("usersCollection").updateOne(
            { username: request.query.username },
            { $set: {top: new ObjectId(request.body.top), bottom: new ObjectId(request.body.bottom), shoes: new ObjectId(request.body.shoes)} }
        );
        if (result) {
            response.send(result);
        }
        else {
            response.status(404).send();
        }
    } catch (e) {
        response.status(500).send({ message: e.message });
    }
});


// old login
// /**
//  * GET user by username and password
//  * 'http://localhost:3005/loginInfoCollection?username=USERNAME&password=PASSWORD'
//  */
// server.get("/loginInfoCollection", async (request, response, next) => {
//     try {
//         let result = await db.collection("loginInfoCollection").findOne({ "username": request.query.username, 
//                                                                           "password": request.query.password });
//         result = await getUserById(result.userRef)
//         if(result) {
//             response.send(result);
//         } 
//         else {
//             response.status(404).send();
//         }
//     } catch (e) {
//         response.status(500).send({ message: e.message });
//     }
// });


// DELETE user by username
// 'http://localhost:3005/users?username=USERNAME'
server.delete("/users", async (request, response, next) => {
    try {
        const username = request.query.username;
        const result1 = await db.collection("usersCollection").deleteOne({ username: username }); 
        const result2 = await db.collection("loginInfoCollection").deleteOne({ username: username });

        if (result1.deletedCount > 0 && result2.deletedCount > 0) {
            response.send({ message: "User deleted successfully." });
        } else {
            response.status(404).send({ message: "User not found." });
        }
    } catch (e) {
        response.status(500).send({ message: e.message });
    }
});




async function main(){

    const client = new MongoClient(uri);

    server.listen("3005", async () => {
        try {
            await client.connect();
            db = client.db("runalong");
        } catch (e) {
            console.error(e);
        }
    });
}

main().catch(console.error);
