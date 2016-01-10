'use strict';

angular.module('inflow-config', [ 'ngRoute' ])

.config(function($routeProvider)
{
  $routeProvider.when('/login',
  {
    templateUrl: 'login.html',
    controller: 'LoginCtrl'
  });
  $routeProvider.when('/tree-config',
  {
    templateUrl: 'tree-config.html',
    controller: 'ConfigCtrl',
    resolve:
    {
      config: function(W4Service, $location) { var promise = W4Service.getConfig(); promise.error(function(){ $location.path('login'); }); return promise;}
    }
  });
  $routeProvider.when('/flat-config',
  {
    templateUrl: 'flat-config.html',
    controller: 'ConfigCtrl',
    resolve:
    {
      config: function(W4Service, $location) { var promise = W4Service.getConfig(); promise.error(function(){ $location.path('login'); }); return promise;}
    }
  });
  $routeProvider.otherwise(
  {
    redirectTo: function(params, path, search)
    {
        return "/login";
    }
  });
})

.factory('W4Service', function($http)
{
  function W4Service()
  {
    this.server = 'localhost:7705';
  }

  W4Service.prototype.setServer = function(server)
  {
    this.server = server;
  }

  W4Service.prototype.api = function(method, url, data)
  {
    var buildParam = function(data)
    {
      var parameters = {};
      angular.forEach(data, function(value, key)
      {
        if (angular.isObject(value) || angular.isArray(value))
        {
          angular.forEach(buildParam(value), function(subValue, subKey)
          {
            parameters[key + "." + subKey] = subValue;
          });
        }
        else
        {
          parameters[key] = value;
        }
      });
      return parameters;
    }

    var request =
    {
      method: method,
      url: 'http://' + this.server + '/' + url,
      headers:
      {
        'Content-Type': undefined
      },
    };
    if (method == 'POST' || method == 'PUT')
    {
      var formData = [];
      angular.forEach(buildParam(data), function(v,k) { formData.push(k + "=" + v); });
      request.data = formData.join('&');
    }
    else
    {
      request.params = buildParam(data);
    }
    return $http(request);
  }
  
  W4Service.prototype.login = function(authenticationName, password)
  {
    var self = this;
    return self.api('POST', 'login',
    {
      'authenticationName': authenticationName,
      'password': password,
      'propagate': false,
    })
      .success(function(data)
      {
        self.principal =
        {
          id: data.principals[0].id,
          name: data.principals[0].name,
          userIdentifier:
          {
            id: data.principals[0].userIdentifier.id,
            name: data.principals[0].userIdentifier.name,
            tenantIdentifier:
            {
              id: data.principals[0].userIdentifier.tenantIdentifier.id
            }
          }
        };
        self.userName = data.name;
      });
  }

  W4Service.prototype.isAuthenticated = function()
  {
    var self = this;
    return angular.isDefined(self.principal);
  }

  W4Service.prototype.getConfig = function()
  {
    var self = this;
    return self.api('GET', 'inflow/configurations',
    {
      'principal': self.principal,
    });
  }

  W4Service.prototype.setConfigValue = function(categorizedKey, value)
  {
    var self = this;
    return self.api('POST', 'inflow/configuration',
    {
      'principal': self.principal,
      'categorizedKey': categorizedKey,
      'value': value,
    });
  }

  W4Service.prototype.removeConfigValue = function(categorizedKey)
  {
    var self = this;
    return self.api('DELETE', 'inflow/configurations',
    {
      'principal': self.principal,
      'categorizedKeys': [ categorizedKey ],
    });
  }

  W4Service.prototype.removeConfigValues = function(categorizedKeys)
  {
    var self = this;
    return self.api('DELETE', 'inflow/configurations',
    {
      'principal': self.principal,
      'categorizedKeys': categorizedKeys,
    });
  }

  return new W4Service();
})

.controller('LoginCtrl', function($scope, $http, $location, W4Service)
{
  $scope.server = W4Service.server;
  $scope.doLogin = function()
  {
    W4Service.server = $scope.server;
    W4Service.login($scope.login, $scope.password)
      .success(function() { $location.path('tree-config'); });
  }
})

.controller('ConfigCtrl', function($scope, config, W4Service)
{
  if (!W4Service.isAuthenticated)
  {
    $location.path('login');
  }

  $scope.config = [];
  $scope.categories = [];
  $scope.queue = [];
  var categories = {};
  for(var k in config.data)
  {
    var semiColumn = k.indexOf(':');
    var category = k.substring(0, semiColumn);
    var key = k.substring(semiColumn + 1);
    var entry = {
      categorizedKey: k,
      category: category,
      key: key,
      value: config.data[k],
    };
    categories[category] = categories[category] || [];
    categories[category].push(entry);
    $scope.config.push(entry);
  }

  for(var k in categories)
  {
    var category = {
      name: k,
      values: categories[k],
      displayed: false,
    };
    category.elementKeys = category.name + ':element_keys';
    var elementKeys = config.data[category.elementKeys];
    if (elementKeys)
    {
      var elements = [];
      for (var i in elementKeys)
      {
        var element = {
          category: category.name,
          collection: elements,
          name: elementKeys[i],
          values: [],
          displayed: false,
        }
        for (var j in category.values)
        {
          var entry = category.values[j];
          var dot = entry.key.indexOf('.');
          var keyPrefix = entry.key.substring(0, dot);
          var keyTail = entry.key.substring(dot+1);
          if (keyPrefix == element.name)
          {
            entry.key = keyTail;
            entry.element = element.name;
            element.values.push(entry);
          }
        }
        elements.push(element);
      }
      category.hasElements = true;
      category.elements = elements;
    }
    $scope.categories.push(category);
  }

  $scope.isArray = angular.isArray;

  $scope.switchDisplayed = function(element)
  {
    element.displayed = !element.displayed;
  };

  var arrayFind = function (ary, property, value)
  {
    var index = -1;
    for (var i in ary)
    {
      var base;
      if (property == '.')
      {
        base = ary[i];
      }
      else
      {
        base = ary[i][property];
      }
      if (base == value)
      {
        index = i;
        break;
      }
    }
    if (index > -1)
    {
      return ary[index];
    }
    return undefined;
  };

  var arrayRemove = function(ary, property, value)
  {
    var index = -1;
    for (var i in ary)
    {
      var base;
      if (property == '.')
      {
        base = ary[i];
      }
      else
      {
        base = ary[i][property];
      }
      if (base == value)
      {
        index = i;
        break;
      }
    }
    if (index > -1)
    {
      ary.splice(index, 1);
    }
    return index;
  };

  $scope.removeElement = function(element)
  {
    arrayRemove(element.collection, 'name', element.name);
    var category = arrayFind($scope.categories, 'name', element.category);

    var categorizedKeys = [];
    for (var j in element.values)
    {
      categorizedKeys.push(element.values[j].categorizedKey);
    }

    var remainingNames = [];
    for(var j in element.collection)
    {
      remainingNames.push(element.collection[j].name);
    }

    $scope.queue.push(function()
    {
      W4Service.removeConfigValues(categorizedKeys);
      W4Service.setConfigValue(category.elementKeys, remainingNames);
    });
  };

  $scope.removeEntry = function(value)
  {
    var category = arrayFind($scope.categories, 'name', value.category);
    arrayRemove(category.values, 'categorizedKey', value.categorizedKey);
    if (value.element)
    {
      var element = arrayFind(category.elements, 'name', value.element);
      arrayRemove(element.values, 'categorizedKey', value.categorizedKey);
    }
    $scope.queue.push(function()
    {
      W4Service.removeConfigValue(value.categorizedKey);
    });
  };

  $scope.removeValue = function(entry, value)
  {
    arrayRemove(entry.value, '.', value);
    $scope.queue.push(function()
    {
      W4Service.setConfigValue(entry.categorizedKey, entry.value);
    });   
  }

  $scope.execQueue = function()
  {
    for(var i in $scope.queue)
    {
      $scope.queue[i]();
    }
    $scope.queue = [];
  };

});
