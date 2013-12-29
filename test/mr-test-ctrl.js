angular.module('MRTest', ['Moonridge']).controller('testCtrl', function ($scope) {
    var MR = $scope.MR;

    var fighterLQ = MR.fighter.liveQuery;
    MR.fighter.create({name: 'Jon Snow', health: 70});
    MR.fighter.create({name: 'Roose Bolton', health: 35});
    var limit = 2;
    $scope.LQ = fighterLQ().sort('health').limit(limit).exec();
//            $scope.LQsec = liveQuery().sort('health').limit(limit).skip(1).exec();
    $scope.oneLQ = fighterLQ().findOne().exec();
    $scope.cLQ = fighterLQ().count().exec();
    $scope.LQ.promise.then(function (LQ) {
        console.log(LQ);
    });

    $scope.changeQuery = function () {
        limit += 1;
        $scope.LQ = fighterLQ().sort('health').limit(limit).exec();
    };

    $scope.hit = function (fighter) {
        fighter.health -= 1;
        MR.fighter.update(fighter);
    };

    $scope.heal = function (fighter) {
        fighter.health += 1;
        MR.fighter.update(fighter);
    };

    $scope.remove = MR.fighter.remove;

    $scope.create = function () {
        MR.fighter.create({name: $scope.name, health: $scope.health});
    };

}).run(function ($MR, $q, $timeout) {
    var dfd = $q.defer();
    var MRB = $MR('local', dfd.promise);
    MRB.connectPromise.then(function (socket) {
        //you can hook up more events here
        socket.on('disconnect', function () {
            console.log("Ha disconnected!");
        });
    });
    $timeout(function () {
        //just an example, in real application you would use here some auth token instead of nick
        dfd.resolve({url: 'http://localhost:8080', hs: { query: "nick=admin" } } );
    }, 900)
});