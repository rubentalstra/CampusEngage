const express = require('express');
const adminApiRouter = express.Router();
const adminApiController = require('../../controller/admin/api');




adminApiRouter.get('/members/pending', adminApiController.getMembersNotActiveAPI);

adminApiRouter.get('/members/typeCounts', adminApiController.getMemberTypeCounts);
adminApiRouter.get('/members/type/:typeId', adminApiController.getMembersByTypeId);




// ... (all other routes)

module.exports = adminApiRouter;
