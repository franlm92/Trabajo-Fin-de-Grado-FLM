using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using MongoDB.Bson;
using MongoDB.Driver;

namespace ScreenCastApp.Services
{
    public class MongoDataService
    {
        private MongoServer server;
        private string database { get; set; }
        public MongoDataService(string connectionString)
        {
            MongoClient client = new MongoClient(connectionString);
#pragma warning disable CS0618 // Type or member is obsolete
            server = client.GetServer();
#pragma warning restore CS0618 // Type or member is obsolete

        }

        public string findOne(string databaseName, string collectionName, string query)
        {
            var db = server.GetDatabase(databaseName);
            var collection = db.GetCollection(collectionName);
            BsonDocument bsonDoc = MongoDB.Bson.Serialization.BsonSerializer.Deserialize<BsonDocument>(query);

            var result = collection.FindOne(new QueryDocument(bsonDoc));
            if (result != null)
            {
                return "USUARIO ENCONTRADO";
            }
            else
            {
                return "CADENA VACIA";
            }
        }

        public string createOne(string databaseName, string collectionName, BsonDocument document)
        {
            var db = server.GetDatabase(databaseName);
            var collection = db.GetCollection(collectionName);

            var result = collection.Insert(new QueryDocument(document));
            if (result != null)
            {
                return "USUARIO CREADO";
            }
            else
            {
                return "USUARIO NO CREADO";
            }
        }
    }
}
