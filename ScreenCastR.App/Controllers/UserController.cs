using MongoDB.Bson;
using ScreenCastApp.Services;
using System;

namespace ScreenCastApp.Controllers
{
    public class UserController
    {
        MongoDataService mongoDB = new MongoDataService("mongodb://localhost:27021");

        public string searchUser(string name, string pass)
        {

            string query = "{'name.given': '" + name + "','pass': '" + pass+"'}";

            Console.WriteLine(query);

            string currentUser = this.mongoDB.findOne("fhir", "Practitioner_4_0_0", query);

            return currentUser;
        }

        public string createUser(string surname, string name, string phone, string gender, string birthDate, string pass)
        {
            BsonDocument newUser = new BsonDocument
                    {
                        { "resourceType", "Practitioner"},
                        { "name", new BsonArray {
                                new BsonDocument
                                {
                                    {"use", "official"},
                                    {"family", surname},
                                    {"given", new BsonArray{
                                        name
                                        }
                                    }
                                },
                                new BsonDocument
                                {
                                    {"use", "usual"},
                                    {"given", new BsonArray{
                                        name
                                        }
                                    }
                                }
                            }
                        },
                        { "telecom", new BsonArray {
                                new BsonDocument
                                {
                                    {"system", "phone"},
                                    {"value", phone},
                                    {"use", "mobile"},
                                    {"rank", "2"}
                                }
                        }
                        },
                        { "gender", gender},
                        { "birthDate", birthDate},
                        { "pass", pass}
                    };

            string insert = this.mongoDB.createOne("fhir", "Practitioner_4_0_0", newUser);

            return insert;
        }
    }
}
