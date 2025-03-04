import { Form, FormSection } from "src/components/form/Form"
import InputSelect from "src/components/select/InputSelect"
import { useEffect, useMemo, useState } from "react"
import {  Panel } from "types/dashboard"
import { queryJaegerOperations, queryJaegerServices } from "../../../datasource/jaeger/query_runner"
import { isEqual, set, sortBy, uniq } from "lodash"
import { EditorInputItem, EditorNumberItem } from "src/components/editor/EditorItem"
import { Button, Checkbox, Divider, Flex, HStack, Input, Text, useMediaQuery } from "@chakra-ui/react"
import storage from "utils/localStorage"
import { TraceSearchKey } from "../config/constants"
import { TimeRange } from "types/time"
import { hasVariableFormat, replaceWithVariablesHasMultiValues } from "utils/variable"
import useBus from "use-bus"
import { ShareUrlEvent } from "src/data/bus-events"
import React from "react";
import { useStore } from "@nanostores/react"
import { tracePanelMsg } from "src/i18n/locales/en"
import { shareUrlParams } from "src/views/dashboard/DashboardShare"
import { isEmpty } from "utils/validate"
import { useSearchParams } from "react-router-dom"
import { $variables } from "src/views/variables/store"
import { getDatasource } from "utils/datasource"
import { MobileBreakpoint } from "src/data/constants"
import { $datasources } from "src/views/datasource/store"
import { addParamToUrl } from "utils/url"
import { DatasourceTypeJaeger } from "../../../datasource/jaeger/types"
interface Props {
    panel: Panel
    onSearch: any
    onSearchIds: any
    dashboardId: string
    timeRange: TimeRange
}

// cache services parsed by variables, when a variable changes, we can compare the new parsed result with cache
// and decide whether need to re-query operations
const traceServicesCache = new Map()
const TraceSearchPanel = ({ timeRange, dashboardId, panel, onSearch, onSearchIds }: Props) => {
    const [searchParams] = useSearchParams()
    const variables = useStore($variables)
    const t1 = useStore(tracePanelMsg)
    const [inited, setInited] = useState(false)
    const [services, setServices] = useState([])
    const [operations, setOperations] = useState([])

    const lastSearch = useMemo(() => storage.get(TraceSearchKey + dashboardId + panel.id) ?? {}, [])
    const [initService, initOperation, initTags, initMax, initMin, initLimit] = getInitParams(searchParams, panel, lastSearch)
    const initTraceIds = searchParams.get('traceIds')
    const [service, setService] = useState<string>(initService)
    const [operation, setOperation] = useState<string>(initOperation)
    const [tags, setTags] = useState<string>(initTags)
    const [max, setMax] = useState<string>(initMax)
    const [min, setMin] = useState<string>(initMin)
    const [limit, setLimit] = useState<number>(initLimit)
    const [traceIds, setTraceIds] = useState<string>(initTraceIds)
    
    const [useLatestTime, setUseLatestTime] = useState(true)
    const datasources = useStore($datasources)
    const ds = getDatasource(panel.datasource.id, datasources)

    useEffect(() => {
        if (!isEmpty(initTraceIds)) {
            onSearchIds(initTraceIds)
            return 
        }

        if (service) {
            loadOperations()
            onSearch(service, operation, tags, min, max, limit, useLatestTime)
        } 

        return () => {
            delete traceServicesCache[dashboardId + panel.id]
        }
    }, [])



    useEffect(() => {
        if (inited) {
            if (!isEmpty(traceIds)) {
                onSearchIds(traceIds)
            } else {
                if (service && operation) {
                    onSearch(service, operation, tags, min, max, limit)
                }
            }
        }
    }, [timeRange])

    useEffect(() => {
        loadServices()
    }, [ds.type])

    useEffect(() => {
        if (inited) {
            if (!isEmpty(traceIds)) {
                onSearchIds(traceIds)
                return 
            }

            if (service) {
                loadOperations()
                onSearch(service, operation, tags, min, max, limit, useLatestTime)
            } else {
                setOperations([])
            }
        }
    }, [service, traceIds])

    useEffect(() => {
        if (inited) {
            setTraceIds(initTraceIds)
        }
    },[initTraceIds])
    useEffect(() => {
        if (!inited) {
            return 
        }
        if (hasVariableFormat(operation)) {
            return
        }

        if (!hasVariableFormat(service)) {
            return
        }
        
        const services = replaceWithVariablesHasMultiValues(service)
        const cachedServices = traceServicesCache[dashboardId + panel.id]
        if (!isEqual(services, cachedServices)) {
            onVariablesChange()
        }
    }, [variables])

    const onVariablesChange = async () => {
        loadOperations()
        if (!isEmpty(traceIds)) {
            onSearchIds(traceIds)
            return 
        }
        onSearch(service, operation, tags, min, max, limit, useLatestTime)
    }

    useBus(
        ShareUrlEvent,
        () => {
            if (!isEmpty(traceIds)) {
                shareUrlParams['traceIds'] = traceIds
            } else {
                if (!isEmpty(service)) shareUrlParams['service'] = service
                if (!isEmpty(operation)) shareUrlParams['operation'] = operation
                if (!isEmpty(tags)) shareUrlParams['tags'] = tags
                if (!isEmpty(max)) shareUrlParams['max'] = max
                if (!isEmpty(min)) shareUrlParams['min'] = min
                if (!isEmpty(limit)) shareUrlParams['limit'] = limit
            }
        },
        [service, operation, tags, max, min, limit, traceIds]
    )


    const loadServices = async () => {
        switch (ds.type) {
            case DatasourceTypeJaeger:
                const res = await queryJaegerServices(panel.datasource.id)
                const ss = sortBy(res)
                setServices(ss)  
                setTimeout(() => {
                    setInited(true)
                    if (ss.length > 0) {
                        if (isEmpty(service)) {
                            setService(ss[0])
                        }
                    }
                }, 500)

                break;

            default:
                break;
        }
    }

    const loadOperations = async (s?) => {
        switch (ds.type) {
            case DatasourceTypeJaeger:
                const services = s ?? replaceWithVariablesHasMultiValues(service)
                traceServicesCache[dashboardId + panel.id] = services
                const res = await Promise.all(services.map(service => queryJaegerOperations(panel.datasource.id, service)))

                const ss = sortBy(uniq(res.filter(r => r).flat()))
                setOperations(['all'].concat(ss))

                if (!hasVariableFormat(operation)) {
                    if (!operation || !ss.includes(operation)) {
                        setOperation('all')
                    }
                }

                break;

            default:
                break;
        }
    }
    
    const onClickSearch = () => {
        if (!isEmpty(traceIds)) {
            onSearchIds(traceIds)
        } else {
            onSearch(service, operation, tags, min, max, limit, useLatestTime)
            storage.set(TraceSearchKey + dashboardId + panel.id, {
                service, operation, tags, min, max, limit
            })
        }
    }

    const [isLargeScreen] = useMediaQuery(MobileBreakpoint)
    const size = "sm"
    return (<>
        <Form spacing={isLargeScreen ? 4 : 2} fontSize={isLargeScreen ? '0.8rem' : "0.7rem"}>
            <FormSection title="Service"  spacing={1}>
                {
                    panel.plugins.trace.enableEditService ?
                        <InputSelect variant="flushed" value={service} options={services.map(s => ({ label: s, value: s }))} size={size} onChange={v => setService(v)} />
                        : <Input variant="flushed" value={service} disabled size={size} />
                }
            </FormSection>
            <FormSection title="Operation" spacing={1}>
                <InputSelect variant="flushed" value={operation} options={operations.map(s => ({ label: s, value: s }))} size={size} onChange={v => setOperation(v)} />
            </FormSection>
            <FormSection title="Tags" spacing={1}>
                <EditorInputItem bordered={false} borderedBottom value={tags} placeholder={`e.g http.status_code=200 error=true`} onChange={v => setTags(v)} />
            </FormSection>
            <Flex flexDir={isLargeScreen ? "row" : "column"} gap={1}>
                <FormSection title={t1.maxDuration}  spacing={1}>
                    <EditorInputItem bordered={false} borderedBottom value={max} placeholder="e.g 1.2s,100ms" onChange={v => setMax(v)} />
                </FormSection>
                <FormSection title={t1.minDuration}  spacing={1}>
                    <EditorInputItem bordered={false} borderedBottom value={min} placeholder="e.g 1.2s,100ms" onChange={v => setMin(v)} />
                </FormSection>
            </Flex>
            <FormSection title={t1.limitResults} spacing={1}>
                <EditorNumberItem bordered={false} value={limit} min={0} onChange={v => setLimit(v)} size="md" />
            </FormSection>
            <Divider pt="2" />
            <FormSection title="Trace ids" spacing={1} desc={t1.traceIdsTips}>
                <EditorInputItem key={traceIds}  placeholder={t1.traceIdsInputTips} value={traceIds} onChange={v => {setTraceIds(v); addParamToUrl({traceIds: v})}} size="md" />
            </FormSection>
            <Flex flexDir={isLargeScreen ? "row" : "column"} justifyContent="space-between" gap={3} pt="2">
                <Button variant="outline" width={isLargeScreen ? "120px" : null} size={size} onClick={onClickSearch}>{isLargeScreen ? t1.findTraces : "Search"}</Button>
                <HStack spacing={1}>
                    <Checkbox isChecked={useLatestTime} onChange={e => setUseLatestTime(e.currentTarget.checked)} />
                    <Text opacity="0.7">{t1.useLatestTime}</Text>
                </HStack>
            </Flex>

        </Form>
    </>)
}

export default TraceSearchPanel


const getInitParams = (searchParams, panel, lastSearch) => {
    let service
    const urlService = searchParams.get('service')
    if (!isEmpty(urlService)) {
        service = urlService
    } else if (!panel.plugins.trace.enableEditService) {
        service = panel.plugins.trace.defaultService
    } else {
        service = lastSearch.service ?? null
    }

    const operation = searchParams.get('operation') ?? (lastSearch.operation ?? null)
    const tags = searchParams.get('tags') ?? (lastSearch.tags ?? '')
    const max = searchParams.get('max') ?? (lastSearch.max ?? '')
    const min = searchParams.get('min') ?? (lastSearch.min ?? '')
    const limit = searchParams.get('limit') ?? (lastSearch.limit ?? 100)
    return [service, operation, tags, max, min, limit]
}